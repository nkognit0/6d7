// The campaign archive `.6d7` (docs/data-model.md, «Архив кампании»): a ZIP with the documents as
// JSON, the media files by their hash and the map tiles. Packing works on bytes only; where the
// files come from and go to is passed in (the browser's stores now, the server later).
import { unzip, zip, strFromU8, strToU8, type AsyncZippable } from 'fflate'
import type { ExploredData } from '../map/core/explored'
import type { MapScene } from '../map/core/types'
import type { TileBlob } from '../map/image/protocol'
import type { GameDoc, GameMap } from './game'
import type { Campaign, CampaignDocs } from './types'

export const ARCHIVE_EXT = '.6d7'
export const ARCHIVE_FORMAT = '6d7'
export const ARCHIVE_SCHEMA = 1
/** Tiles go into the archive while it stays this small; bigger — only originals (QnA). */
export const TILES_LIMIT = 50 * 1024 * 1024

export interface Manifest {
  format: typeof ARCHIVE_FORMAT
  schema: number
  /** a whole campaign, or only the state of its game («Экспорт состояния игры»); a campaign by default */
  kind?: 'campaign' | 'game'
  campaign: string
  name: string
  exported: string
  maps: string[]
  seats: string[]
  media: string[]
  /** pictures whose tiles are in the archive; the others are cut again from their originals */
  tiles: string[]
  /** the game, if the master has started it: its maps and explored masks (`game/…`) */
  game?: { maps: string[]; explored: Record<string, { w: number; h: number }> }
}

/** The state of a game alone: what «Импортировать состояние игры» takes into its campaign. */
export interface GameState {
  campaign: string
  game: GameDoc
  gameMaps: Record<string, GameMap>
  explored: Record<string, ExploredData>
  seats: CampaignDocs['seats']
}

export class ArchiveError extends Error {
  /**
   * `game` — the state of a game where a campaign is expected, `notGame` — the other way round,
   * `otherCampaign` — the state of a game of another campaign
   */
  constructor(public code: 'format' | 'version' | 'damaged' | 'game' | 'notGame' | 'otherCampaign', message: string = code) {
    super(message)
  }
}

/** Where packing reads and unpacking puts files. */
export interface ArchiveFiles {
  getMedia(ref: string): Promise<Blob | null>
  putMedia(blob: Blob): Promise<string>
  listTiles(imageId: string): Promise<TileBlob[]>
  putTiles(imageId: string, tiles: TileBlob[]): Promise<void>
  /** cuts an original again when the archive came without its tiles */
  recut(original: Blob, imageId: string): Promise<void>
}

const MEDIA_REF = /media:[0-9a-f]{64}/g
const EXT: Record<string, string> = { 'image/webp': 'webp', 'image/png': 'png', 'image/jpeg': 'jpg', 'image/avif': 'avif' }
const TYPE: Record<string, string> = Object.fromEntries(Object.entries(EXT).map(([t, e]) => [e, t]))

const ext = (blob: Blob) => EXT[blob.type] ?? 'bin'
const bytes = async (blob: Blob) => new Uint8Array(await blob.arrayBuffer())
const json = (v: unknown) => strToU8(JSON.stringify(v))
// pictures are compressed already: stored as they are; JSON is deflated
const STORE = { level: 0 } as const

/** Every media file the documents point to (explored masks are bytes: no references there). */
export function mediaRefs(docs: Partial<CampaignDocs>): string[] {
  return [...new Set(JSON.stringify({ ...docs, explored: undefined }).match(MEDIA_REF) ?? [])]
}

// media files into the archive; their hashes and total size
async function packMedia(out: AsyncZippable, refs: string[], files: ArchiveFiles): Promise<{ media: string[]; size: number }> {
  const media: string[] = []
  let size = 0
  for (const ref of refs) {
    const blob = await files.getMedia(ref)
    if (!blob) continue
    const hash = ref.slice(6)
    out[`media/${hash}.${ext(blob)}`] = [await bytes(blob), STORE]
    media.push(hash)
    size += blob.size
  }
  return { media, size }
}

// the game documents: `game/state.json`, `game/maps/<id>.json`, masks as raw bytes
function packGameDocs(out: AsyncZippable, docs: Partial<CampaignDocs>): Manifest['game'] {
  if (!docs.game) return undefined
  out['game/state.json'] = json(docs.game)
  for (const [id, gm] of Object.entries(docs.gameMaps ?? {})) out[`game/maps/${id}.json`] = json(gm)
  const explored: Record<string, { w: number; h: number }> = {}
  for (const [id, ex] of Object.entries(docs.explored ?? {})) {
    out[`game/${id}.explored.bin`] = ex.data
    explored[id] = { w: ex.w, h: ex.h }
  }
  return { maps: Object.keys(docs.gameMaps ?? {}), explored }
}

function zipAsync(files: AsyncZippable): Promise<Uint8Array> {
  return new Promise((resolve, reject) => zip(files, { level: 6 }, (err, out) => (err ? reject(err) : resolve(out))))
}

function unzipAsync(data: Uint8Array): Promise<Record<string, Uint8Array>> {
  return new Promise((resolve, reject) => unzip(data, (err, out) => (err ? reject(err) : resolve(out))))
}

/** Packs a campaign; `exported` — the date for the manifest. */
export async function packArchive(docs: CampaignDocs, files: ArchiveFiles, exported = new Date()): Promise<Uint8Array> {
  const out: AsyncZippable = {}
  const { media, size } = await packMedia(out, mediaRefs(docs), files)

  // tiles: always for a picture without its original (it cannot be cut again), the rest while small
  const images = Object.values(docs.maps).map((m) => m.image).filter((i): i is NonNullable<MapScene['image']> => !!i)
  const tiles = new Map<string, TileBlob[]>()
  for (const img of images) tiles.set(img.id, await files.listTiles(img.id))
  const tileBytes = [...tiles.values()].flat().reduce((s, t) => s + t.blob.size, 0)
  const withTiles = images.filter((img) => !img.original || size + tileBytes <= TILES_LIMIT).map((img) => img.id)
  for (const id of withTiles) {
    for (const t of tiles.get(id) ?? []) out[`tiles/${id}/${t.level}/${t.col}-${t.row}.${ext(t.blob)}`] = [await bytes(t.blob), STORE]
  }

  const manifest: Manifest = {
    format: ARCHIVE_FORMAT,
    schema: ARCHIVE_SCHEMA,
    campaign: docs.campaign.id,
    name: docs.campaign.name,
    exported: exported.toISOString(),
    maps: Object.keys(docs.maps),
    seats: Object.keys(docs.seats),
    media,
    tiles: withTiles,
    game: packGameDocs(out, docs)
  }
  out['manifest.json'] = json(manifest)
  out['campaign.json'] = json(docs.campaign)
  for (const [id, scene] of Object.entries(docs.maps)) out[`maps/${id}.json`] = json(scene)
  for (const [id, seat] of Object.entries(docs.seats)) out[`seats/${id}.json`] = json(seat)
  return zipAsync(out)
}

/**
 * The state of a game as a file of its own: the game documents, the seats and their media (the
 * maps themselves stay in the campaign).
 */
export async function packGame(docs: CampaignDocs, files: ArchiveFiles, exported = new Date()): Promise<Uint8Array> {
  const out: AsyncZippable = {}
  const part = { game: docs.game ?? { schema: 1, active: null }, gameMaps: docs.gameMaps ?? {}, explored: docs.explored ?? {}, seats: docs.seats }
  // the seats and the tokens of the game; the map pictures are in the campaign already
  const used = JSON.stringify({ seats: part.seats, tokens: Object.values(part.gameMaps).map((gm) => gm.scene.tokens) })
  const { media } = await packMedia(out, [...new Set(used.match(MEDIA_REF) ?? [])], files)
  const manifest: Manifest = {
    format: ARCHIVE_FORMAT,
    schema: ARCHIVE_SCHEMA,
    kind: 'game',
    campaign: docs.campaign.id,
    name: docs.campaign.name,
    exported: exported.toISOString(),
    maps: [],
    seats: Object.keys(part.seats),
    media,
    tiles: [],
    game: packGameDocs(out, part)
  }
  out['manifest.json'] = json(manifest)
  for (const [id, seat] of Object.entries(part.seats)) out[`seats/${id}.json`] = json(seat)
  return zipAsync(out)
}

// the files of an archive, its manifest and a reader of its JSON parts
async function openArchive(data: Uint8Array) {
  let entries: Record<string, Uint8Array>
  try {
    entries = await unzipAsync(data)
  } catch {
    throw new ArchiveError('format')
  }
  const read = <T>(path: string): T => {
    const e = entries[path]
    if (!e) throw new ArchiveError('damaged', `no ${path}`)
    try {
      return JSON.parse(strFromU8(e)) as T
    } catch {
      throw new ArchiveError('damaged', `bad ${path}`)
    }
  }
  if (!entries['manifest.json']) throw new ArchiveError('format')
  const manifest = read<Manifest>('manifest.json')
  if (manifest.format !== ARCHIVE_FORMAT) throw new ArchiveError('format')
  if (!(manifest.schema <= ARCHIVE_SCHEMA)) throw new ArchiveError('version')
  return { entries, manifest, read }
}

// the media files of an archive into `files`, by hash
async function unpackMedia(entries: Record<string, Uint8Array>, files: ArchiveFiles): Promise<Map<string, Blob>> {
  const media = new Map<string, Blob>()
  for (const [path, data] of Object.entries(entries)) {
    const m = /^media\/([0-9a-f]{64})\.(\w+)$/.exec(path)
    if (!m) continue
    const blob = new Blob([data], { type: TYPE[m[2]] ?? '' })
    media.set(m[1], blob)
    await files.putMedia(blob)
  }
  return media
}

function readGameDocs(manifest: Manifest, entries: Record<string, Uint8Array>, read: <T>(path: string) => T) {
  if (!manifest.game) return null
  const gameMaps: Record<string, GameMap> = {}
  for (const id of manifest.game.maps) gameMaps[id] = read<GameMap>(`game/maps/${id}.json`)
  const explored: Record<string, ExploredData> = {}
  for (const [id, { w, h }] of Object.entries(manifest.game.explored)) {
    const data = entries[`game/${id}.explored.bin`]
    if (!data || data.length !== w * h) throw new ArchiveError('damaged', `bad explored ${id}`)
    explored[id] = { w, h, data }
  }
  return { game: read<GameDoc>('game/state.json'), gameMaps, explored }
}

/** Reads the state of a game («Импортировать состояние игры»); its media go into `files`. */
export async function unpackGame(data: Uint8Array, files: ArchiveFiles): Promise<GameState> {
  const { entries, manifest, read } = await openArchive(data)
  if (manifest.kind !== 'game') throw new ArchiveError('notGame')
  const game = readGameDocs(manifest, entries, read)
  if (!game) throw new ArchiveError('damaged', 'no game')
  const seats: CampaignDocs['seats'] = {}
  for (const id of manifest.seats) seats[id] = read(`seats/${id}.json`)
  await unpackMedia(entries, files)
  return { campaign: manifest.campaign, ...game, seats }
}

/**
 * Reads an archive: puts its media and tiles into `files` and returns the documents. Pictures
 * that came without tiles are cut again from their originals.
 */
export async function unpackArchive(data: Uint8Array, files: ArchiveFiles): Promise<CampaignDocs> {
  const { entries, manifest, read } = await openArchive(data)
  if (manifest.kind === 'game') throw new ArchiveError('game')

  const docs: CampaignDocs = { campaign: read<Campaign>('campaign.json'), maps: {}, seats: {} }
  for (const id of manifest.maps) docs.maps[id] = read<MapScene>(`maps/${id}.json`)
  for (const id of manifest.seats) docs.seats[id] = read(`seats/${id}.json`)
  const game = readGameDocs(manifest, entries, read)
  if (game) Object.assign(docs, game)

  const media = await unpackMedia(entries, files)

  const tiles = new Map<string, TileBlob[]>()
  for (const [path, data] of Object.entries(entries)) {
    const m = /^tiles\/([^/]+)\/(\d+)\/(\d+)-(\d+)\.(\w+)$/.exec(path)
    if (!m) continue
    const list = tiles.get(m[1]) ?? []
    list.push({ level: +m[2], col: +m[3], row: +m[4], blob: new Blob([data], { type: TYPE[m[5]] ?? '' }) })
    tiles.set(m[1], list)
  }
  for (const scene of Object.values(docs.maps)) {
    const img = scene.image
    if (!img) continue
    const own = tiles.get(img.id)
    if (own?.length) await files.putTiles(img.id, own)
    else {
      const original = img.original && media.get(img.original.slice(6))
      if (!original) throw new ArchiveError('damaged', `no tiles of ${img.id}`)
      await files.recut(original, img.id)
    }
  }
  return docs
}
