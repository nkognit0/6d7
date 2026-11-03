// The campaigns of this browser (IndexedDB): documents, the journal of changes, the home screen
// summaries, map tiles and the stub codes of players. The server will take its place behind the
// same methods.
import type { MapImageInfo, TileProvider } from '../../map/core/types'
import type { TileSink } from '../../map/image/pyramid'
import type { TileBlob } from '../../map/image/protocol'
import { applyChange, createCampaign, metaOf, newCode } from '../campaign'
import { CampaignSession, type DocWrite, type SessionStorage } from '../session'
import type { Campaign, CampaignDocs, CampaignMeta, Change, DocKey } from '../types'
import { prefixRange, request, S, transact } from './idb'

/** A saved change: when it was made (the order across tabs) and the change itself. */
interface JournalEntry {
  t: number
  c: Change
}

// an entry of the first journal format was the change itself
const entryOf = (v: JournalEntry | Change): JournalEntry => ('c' in v && 't' in v ? v : { t: 0, c: v as Change })

/** Where a player's code leads. */
export interface CodeTarget {
  code: string
  campaign: string
  player: string
}

/** Tiles of map pictures, kept until no campaign uses the picture. */
export class LocalTiles implements TileProvider, TileSink {
  async load(image: MapImageInfo, level: number, col: number, row: number): Promise<ImageBitmap> {
    const blob = await transact([S.tiles], 'readonly', (tx) => request<Blob | undefined>(tx.objectStore(S.tiles).get([image.id, level, col, row])))
    if (!blob) throw new Error(`no tile ${level}/${col}/${row}`)
    return createImageBitmap(blob)
  }

  add(imageId: string, tiles: TileBlob[]): Promise<void> {
    return transact([S.tiles], 'readwrite', (tx) => {
      const store = tx.objectStore(S.tiles)
      for (const t of tiles) store.put(t.blob, [imageId, t.level, t.col, t.row])
    })
  }

  list(imageId: string): Promise<TileBlob[]> {
    return transact([S.tiles], 'readonly', async (tx) => {
      const store = tx.objectStore(S.tiles)
      const range = prefixRange(imageId)
      const [keys, blobs] = await Promise.all([request(store.getAllKeys(range)), request<Blob[]>(store.getAll(range))])
      return keys.map((k, i) => {
        const [, level, col, row] = k as [string, number, number, number]
        return { level, col, row, blob: blobs[i] }
      })
    })
  }

  async has(imageId: string): Promise<boolean> {
    const n = await transact([S.tiles], 'readonly', (tx) => request(tx.objectStore(S.tiles).count(prefixRange(imageId))))
    return n > 0
  }
}

export class LocalRepo implements SessionStorage {
  readonly tiles = new LocalTiles()

  /** Campaigns for the home screen, the last changed first. */
  async list(): Promise<CampaignMeta[]> {
    const [metas, pending] = await transact([S.meta, S.journal], 'readonly', async (tx) => {
      const metas = await request<CampaignMeta[]>(tx.objectStore(S.meta).getAll())
      const keys = (await request(tx.objectStore(S.journal).getAllKeys())) as [string, number][]
      return [metas, new Set(keys.map((k) => k[0]))] as const
    })
    // a campaign closed before its snapshot: its journal has the latest name and players
    const fresh = await Promise.all(metas.map(async (m) => {
      if (!pending.has(m.id)) return m
      const loaded = await this.load(m.id)
      return loaded ? metaOf(loaded.docs, m.updated) : m
    }))
    return fresh.sort((a, b) => b.updated - a.updated)
  }

  /** A new empty campaign; its id. */
  async create(name: string): Promise<string> {
    const campaign = createCampaign(name)
    await this.write({ campaign, maps: {}, seats: {} })
    return campaign.id
  }

  /**
   * The documents of a campaign with its journal replayed; null if there is none. `journal` — how
   * many changes were not in the snapshots yet.
   */
  async load(id: string): Promise<{ docs: CampaignDocs; journal: number } | null> {
    const { keys, values, journal } = await transact([S.docs, S.journal], 'readonly', async (tx) => {
      const docs = tx.objectStore(S.docs)
      const range = prefixRange(id)
      const [keys, values, journal] = await Promise.all([
        request(docs.getAllKeys(range)),
        request<unknown[]>(docs.getAll(range)),
        request<(JournalEntry | Change)[]>(tx.objectStore(S.journal).getAll(range))
      ])
      return { keys: keys as [string, DocKey][], values, journal }
    })
    const at = keys.findIndex((k) => k[1] === 'campaign')
    if (at < 0) return null
    let docs: CampaignDocs = { campaign: values[at] as Campaign, maps: {}, seats: {} }
    keys.forEach(([, key], i) => {
      if (key !== 'campaign') docs = applyChange(docs, { doc: key, set: values[i] })
    })
    // the journals of several tabs: in the order the changes were made (a stable sort keeps the order of one tab)
    const entries = journal.map(entryOf).sort((a, b) => a.t - b.t)
    for (const e of entries) docs = applyChange(docs, e.c)
    return { docs, journal: entries.length }
  }

  /**
   * Opens a campaign for the editor or the game. A journal left by a closed tab (or written by an
   * open one) is taken into the snapshots first: the documents now hold every change.
   */
  async open(id: string): Promise<CampaignSession | null> {
    const loaded = await this.load(id)
    if (!loaded) return null
    if (loaded.journal) await this.snapshot(loaded.docs)
    await this.collectTiles()
    return new CampaignSession(loaded.docs, this)
  }

  // every document of a campaign written whole, its journal cleared; the codes stay
  private snapshot(docs: CampaignDocs): Promise<void> {
    const id = docs.campaign.id
    return transact([S.docs, S.journal, S.meta], 'readwrite', (tx) => {
      const store = tx.objectStore(S.docs)
      store.delete(prefixRange(id))
      store.put(docs.campaign, [id, 'campaign'])
      for (const [mapId, scene] of Object.entries(docs.maps)) store.put(scene, [id, `map/${mapId}`])
      for (const [playerId, seat] of Object.entries(docs.seats)) store.put(seat, [id, `seat/${playerId}`])
      tx.objectStore(S.journal).delete(prefixRange(id))
      tx.objectStore(S.meta).put(metaOf(docs, Date.now()), id)
    })
  }

  /** Each tab writes its own journal ([campaign, tab, number]): two tabs never overwrite each other. */
  append(campaignId: string, tab: string, from: number, changes: Change[]): Promise<void> {
    const t = Date.now()
    return transact([S.journal], 'readwrite', (tx) => {
      const store = tx.objectStore(S.journal)
      changes.forEach((c, i) => store.put({ t, c } satisfies JournalEntry, [campaignId, tab, from + i]))
    })
  }

  compact(campaignId: string, tab: string, upto: number, writes: DocWrite[], meta: CampaignMeta): Promise<void> {
    return transact([S.docs, S.journal, S.meta], 'readwrite', (tx) => {
      const docs = tx.objectStore(S.docs)
      for (const [key, value] of writes) {
        if (value === null || value === undefined) docs.delete([campaignId, key])
        else docs.put(value, [campaignId, key])
      }
      tx.objectStore(S.journal).delete(IDBKeyRange.bound([campaignId, tab, 0], [campaignId, tab, upto]))
      tx.objectStore(S.meta).put(meta, campaignId)
    })
  }

  /**
   * Writes a whole campaign under `docs.campaign.id`, replacing whatever was there (import). The
   * old codes of its players go: an import gives new ones.
   */
  write(docs: CampaignDocs): Promise<void> {
    const id = docs.campaign.id
    return transact([S.docs, S.journal, S.meta, S.codes], 'readwrite', async (tx) => {
      await this.clear(tx, id)
      const store = tx.objectStore(S.docs)
      store.put(docs.campaign, [id, 'campaign'])
      for (const [mapId, scene] of Object.entries(docs.maps)) store.put(scene, [id, `map/${mapId}`])
      for (const [playerId, seat] of Object.entries(docs.seats)) store.put(seat, [id, `seat/${playerId}`])
      tx.objectStore(S.meta).put(metaOf(docs, Date.now()), id)
    })
  }

  /** Renames a campaign that is not open (the home screen). */
  async rename(id: string, name: string): Promise<void> {
    const session = await this.open(id)
    if (!session) return
    session.apply([{ doc: 'campaign', op: { type: 'rename', name } }], { record: false })
    await session.close()
  }

  /** Deletes a campaign with its journal and codes; tiles no other campaign uses go too. */
  async remove(id: string): Promise<void> {
    await transact([S.docs, S.journal, S.meta, S.codes], 'readwrite', (tx) => this.clear(tx, id))
    await this.collectTiles()
  }

  private async clear(tx: IDBTransaction, id: string) {
    tx.objectStore(S.docs).delete(prefixRange(id))
    tx.objectStore(S.journal).delete(prefixRange(id))
    tx.objectStore(S.meta).delete(id)
    const codes = tx.objectStore(S.codes)
    const keys = await request(codes.index('campaign').getAllKeys(id))
    for (const k of keys) codes.delete(k)
  }

  /** Codes of the players (made for those who have none yet). */
  codes(campaignId: string, playerIds: string[]): Promise<Record<string, string>> {
    return transact([S.codes], 'readwrite', async (tx) => {
      const store = tx.objectStore(S.codes)
      const [all, own] = await Promise.all([
        request(store.getAllKeys()),
        request<CodeTarget[]>(store.index('campaign').getAll(campaignId))
      ])
      const taken = new Set(all as string[])
      const result: Record<string, string> = {}
      for (const c of own) result[c.player] = c.code
      for (const player of playerIds) {
        if (result[player]) continue
        const code = newCode((c) => taken.has(c))
        taken.add(code)
        result[player] = code
        store.put({ code, campaign: campaignId, player } satisfies CodeTarget)
      }
      return result
    })
  }

  /** Forgets the codes of a campaign: an import gives its players new ones. */
  resetCodes(campaignId: string): Promise<void> {
    return transact([S.codes], 'readwrite', async (tx) => {
      const store = tx.objectStore(S.codes)
      for (const k of await request(store.index('campaign').getAllKeys(campaignId))) store.delete(k)
    })
  }

  /** Where a code leads; null for a code this browser does not know or a removed player. */
  async findCode(code: string): Promise<CodeTarget | null> {
    const target = await transact([S.codes], 'readonly', (tx) => request<CodeTarget | undefined>(tx.objectStore(S.codes).get(code)))
    if (!target) return null
    const loaded = await this.load(target.campaign)
    return loaded?.docs.campaign.players.some((p) => p.id === target.player) ? target : null
  }

  /** Deletes the tiles of pictures no campaign uses any more (a replaced picture, a deleted campaign). */
  async collectTiles(): Promise<void> {
    await transact([S.meta, S.tiles], 'readwrite', async (tx) => {
      const metas = await request<CampaignMeta[]>(tx.objectStore(S.meta).getAll())
      const used = new Set(metas.flatMap((m) => m.images ?? []))
      const tiles = tx.objectStore(S.tiles)
      const keys = (await request(tiles.getAllKeys())) as [string, number, number, number][]
      const gone = new Set(keys.map((k) => k[0]).filter((img) => !used.has(img)))
      for (const img of gone) tiles.delete(prefixRange(img))
    })
  }
}


/** The repository of this browser. */
export const repo = new LocalRepo()
