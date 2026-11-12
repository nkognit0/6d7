// The campaigns of this browser (IndexedDB): documents, the journal of changes, the home screen
// summaries, map tiles and the stub codes of players. The server will take its place behind the
// same methods.
import { collectMedia, getMedia } from '../../game/media/media'
import type { MediaRef } from '../../game/seat/seat'
import type { MapImageInfo, TileProvider } from '../../map/core/types'
import { importMapImage, type TileSink } from '../../map/image/pyramid'
import type { TileBlob } from '../../map/image/protocol'
import { MEDIA_REF } from '../archive'
import { applyChange, createCampaign, docEntries, imagesIn, metaOf, newCode, splitKey } from '../campaign'
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
  // pictures being cut again from their originals, and those that could not be
  private recutting = new Map<string, Promise<void>>()
  private unrecoverable = new Set<string>()

  async load(image: MapImageInfo, level: number, col: number, row: number): Promise<ImageBitmap> {
    let blob = await this.get(image.id, level, col, row)
    if (!blob && image.original && !(await this.has(image.id))) {
      await this.recut(image)
      blob = await this.get(image.id, level, col, row)
    }
    if (!blob) throw new Error(`no tile ${level}/${col}/${row}`)
    return createImageBitmap(blob)
  }

  private get(imageId: string, level: number, col: number, row: number): Promise<Blob | undefined> {
    return transact([S.tiles], 'readonly', (tx) => request<Blob | undefined>(tx.objectStore(S.tiles).get([imageId, level, col, row])))
  }

  /**
   * A picture without tiles (they were collected while an undo or another tab still showed it):
   * its original is cut again under the same id. Every tile waiting for it waits for one cut.
   */
  private recut(image: MapImageInfo): Promise<void> {
    if (this.unrecoverable.has(image.id)) return Promise.resolve()
    let job = this.recutting.get(image.id)
    if (!job) {
      job = (async () => {
        const original = await getMedia(image.original as MediaRef)
        if (!original) throw new Error(`no original of ${image.id}`)
        await importMapImage(original, this, undefined, image.id)
      })()
        .catch((e) => {
          this.unrecoverable.add(image.id)
          console.error('recut', e)
        })
        .finally(() => this.recutting.delete(image.id))
      this.recutting.set(image.id, job)
    }
    return job
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
    // the tiles and files of replaced pictures go without holding the campaign up
    this.collectTiles().catch((e) => console.error('tiles', e))
    this.collectMedia().catch((e) => console.error('media', e))
    return new CampaignSession(loaded.docs, this)
  }

  // every document of a campaign written whole, its journal cleared; the codes stay
  private snapshot(docs: CampaignDocs): Promise<void> {
    const id = docs.campaign.id
    return transact([S.docs, S.journal, S.meta], 'readwrite', (tx) => {
      const store = tx.objectStore(S.docs)
      store.delete(prefixRange(id))
      for (const [key, value] of docEntries(docs)) store.put(value, [id, key])
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
      for (const [key, value] of docEntries(docs)) store.put(value, [id, key])
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
    // its files go at once (no history of it is left to bring them back) unless another campaign has them
    const own = await transact([S.docs, S.journal], 'readonly', (tx) => this.refsIn(tx, prefixRange(id)))
    await transact([S.docs, S.journal, S.meta, S.codes], 'readwrite', (tx) => this.clear(tx, id))
    await this.collectTiles()
    await this.collectMedia(own)
  }

  // every reference to a media file in the documents and journals (of all campaigns, or a range)
  private async refsIn(tx: IDBTransaction, range?: IDBKeyRange): Promise<Set<string>> {
    const [keys, values, journal] = await Promise.all([
      request(tx.objectStore(S.docs).getAllKeys(range)) as Promise<[string, DocKey][]>,
      request<unknown[]>(tx.objectStore(S.docs).getAll(range)),
      request<(JournalEntry | Change)[]>(tx.objectStore(S.journal).getAll(range))
    ])
    const refs = new Set<string>()
    // explored masks are bytes: no references there (and long to write out)
    const scan = (key: DocKey, value: unknown) => {
      if (splitKey(key)[0] === 'game/explored') return
      for (const r of JSON.stringify(value)?.match(MEDIA_REF) ?? []) refs.add(r)
    }
    keys.forEach(([, key], i) => scan(key, values[i]))
    for (const e of journal) scan(entryOf(e).c.doc, entryOf(e).c)
    return refs
  }

  /**
   * Collects the media files no campaign refers to any more (a replaced picture or portrait, a
   * deleted campaign): a day after the first time nothing referred to them, or at once for `now`.
   */
  async collectMedia(now?: ReadonlySet<string>): Promise<void> {
    const used = await transact([S.docs, S.journal, S.meta], 'readonly', async (tx) => {
      const refs = await this.refsIn(tx)
      // the home screen shows the summaries' pictures
      for (const m of await request<CampaignMeta[]>(tx.objectStore(S.meta).getAll())) if (m.preview) refs.add(m.preview)
      return refs
    })
    await collectMedia(used, now)
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

  /**
   * Deletes the tiles of pictures no campaign uses any more (a replaced picture, a deleted
   * campaign). What is used is read from the maps themselves — of the editor and of the game — and
   * from the journals not in the snapshots yet, in one transaction with the deletion: a tab that
   * saves meanwhile waits. A picture only an undo of an open tab still knows is cut again from its
   * original when it is shown (`LocalTiles.load`).
   */
  async collectTiles(): Promise<void> {
    await transact([S.docs, S.journal, S.tiles], 'readwrite', async (tx) => {
      const docs = tx.objectStore(S.docs)
      const [docKeys, journal] = await Promise.all([
        request(docs.getAllKeys()) as Promise<[string, DocKey][]>,
        request<(JournalEntry | Change)[]>(tx.objectStore(S.journal).getAll())
      ])
      const maps = docKeys.filter(([, key]) => ['map', 'game/map'].includes(splitKey(key)[0]))
      const values = await Promise.all(maps.map((k) => request(docs.get(k))))
      const used = new Set([
        ...maps.flatMap(([, key], i) => imagesIn({ doc: key, set: values[i] })),
        ...journal.flatMap((e) => imagesIn(entryOf(e).c))
      ])
      const tiles = tx.objectStore(S.tiles)
      const keys = (await request(tiles.getAllKeys())) as [string, number, number, number][]
      const gone = new Set(keys.map((k) => k[0]).filter((img) => !used.has(img)))
      for (const img of gone) tiles.delete(prefixRange(img))
    })
  }
}


/** The repository of this browser. */
export const repo = new LocalRepo()
