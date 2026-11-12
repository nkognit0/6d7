import { zipSync, strToU8 } from 'fflate'
import { describe, expect, it } from 'vitest'
import { createScene } from '../map/core/scene'
import type { TileBlob } from '../map/image/protocol'
import { ArchiveError, packArchive, packGame, TILES_LIMIT, unpackArchive, unpackGame, type ArchiveFiles } from './archive'
import { createCampaign } from './campaign'
import type { CampaignDocs } from './types'

const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')

// media and tiles kept in memory, as the browser stores keep them
function memoryFiles() {
  const media = new Map<string, Blob>()
  const tiles = new Map<string, TileBlob[]>()
  const recut: string[] = []
  const files: ArchiveFiles = {
    getMedia: async (ref) => media.get(ref) ?? null,
    putMedia: async (blob) => {
      const ref = `media:${hex(await crypto.subtle.digest('SHA-256', await blob.arrayBuffer()))}`
      media.set(ref, blob)
      return ref
    },
    listTiles: async (id) => tiles.get(id) ?? [],
    putTiles: async (id, list) => void tiles.set(id, list),
    recut: async (_original, id) => void recut.push(id)
  }
  return { files, media, tiles, recut }
}

async function campaign(files: ArchiveFiles, tileBytes = 1000): Promise<CampaignDocs> {
  const original = await files.putMedia(new Blob([new Uint8Array(3000).fill(7)], { type: 'image/png' }))
  const preview = await files.putMedia(new Blob([new Uint8Array(200).fill(9)], { type: 'image/webp' }))
  const portrait = await files.putMedia(new Blob([new Uint8Array(100).fill(1)], { type: 'image/webp' }))
  await files.putTiles('img1', [
    { level: 0, col: 0, row: 0, blob: new Blob([new Uint8Array(tileBytes).fill(2)], { type: 'image/webp' }) },
    { level: 1, col: 0, row: 0, blob: new Blob([new Uint8Array(10).fill(3)], { type: 'image/webp' }) }
  ])
  const map = { ...createScene('Таверна'), id: 'm1', image: { id: 'img1', width: 900, height: 600, tileSize: 512, levels: 2, original, preview } }
  return {
    campaign: { ...createCampaign('Кампания', 'c1'), maps: ['m1'], players: [{ id: 'p1', name: 'Арина', color: 'red' }] },
    maps: { m1: map },
    seats: { p1: { schema: 1, sheet: { name: 'Арина', appearance: portrait }, spells: [{ id: 'fireball' }], inventory: [null], companion: null } }
  }
}

describe('archive .6d7', () => {
  it('keeps everything: documents, media and tiles', async () => {
    const from = memoryFiles()
    const docs = await campaign(from.files)
    const bytes = await packArchive(docs, from.files)
    const to = memoryFiles()
    expect(await unpackArchive(bytes, to.files)).toEqual(docs)
    expect([...to.media.keys()].sort()).toEqual([...from.media.keys()].sort())
    expect(to.tiles.get('img1')?.map((t) => t.blob.size).sort()).toEqual([10, 1000])
    expect(to.recut).toEqual([])
  })

  it('leaves big tiles out and cuts the original again', async () => {
    const from = memoryFiles()
    const docs = await campaign(from.files, TILES_LIMIT)
    const to = memoryFiles()
    expect(await unpackArchive(await packArchive(docs, from.files), to.files)).toEqual(docs)
    expect(to.tiles.size).toBe(0)
    expect(to.recut).toEqual(['img1'])
  })

  it('refuses what is not an archive of the app', async () => {
    const { files } = memoryFiles()
    await expect(unpackArchive(strToU8('not a zip'), files)).rejects.toMatchObject({ code: 'format' })
    await expect(unpackArchive(zipSync({ 'a.txt': strToU8('a') }), files)).rejects.toBeInstanceOf(ArchiveError)
    const newer = zipSync({ 'manifest.json': strToU8(JSON.stringify({ format: '6d7', schema: 99 })) })
    await expect(unpackArchive(newer, files)).rejects.toMatchObject({ code: 'version' })
  })
})

// a campaign with a started game: the map as played and a mask of what was explored
async function withGame(files: ArchiveFiles): Promise<CampaignDocs> {
  const docs = await campaign(files)
  const scene = { ...docs.maps.m1, tokens: [{ id: 'p1', kind: 'player' as const, name: 'Арина', image: docs.seats.p1.sheet.appearance as string, pin: { space: 'grid' as const, u: 1.5, v: 1.5 } }] }
  const data = new Uint8Array(4 * 3)
  data[5] = 255
  return { ...docs, game: { schema: 1, active: 'm1' }, gameMaps: { m1: { schema: 1, scene, base: docs.maps.m1 } }, explored: { m1: { w: 4, h: 3, data } } }
}

describe('the game in archives', () => {
  it('a campaign archive keeps its game', async () => {
    const from = memoryFiles()
    const docs = await withGame(from.files)
    expect(await unpackArchive(await packArchive(docs, from.files), memoryFiles().files)).toEqual(docs)
  })

  it('the state of a game goes alone and comes back into its campaign', async () => {
    const from = memoryFiles()
    const docs = await withGame(from.files)
    const bytes = await packGame(docs, from.files)
    const to = memoryFiles()
    const state = await unpackGame(bytes, to.files)
    expect(state).toEqual({ campaign: 'c1', game: docs.game, gameMaps: docs.gameMaps, explored: docs.explored, seats: docs.seats })
    // only the portrait travels: the map pictures stay in the campaign
    expect(to.media.size).toBe(1)
    await expect(unpackArchive(bytes, memoryFiles().files)).rejects.toMatchObject({ code: 'game' })
    await expect(unpackGame(await packArchive(docs, from.files), memoryFiles().files)).rejects.toMatchObject({ code: 'notGame' })
  })
})
