// An open campaign: its documents in memory, every change saved at once (a journal of changes,
// a snapshot in pauses — docs/data-model.md, «Автосохранение») and the history of «Отменить».
// The editor and the master's game work with it; the network will feed it the same changes.
import type { Seat } from '../game/seat/seat'
import { newId } from '../map/core/geometry'
import { invertMapOp } from '../map/core/invert'
import { MapStore } from '../map/core/store'
import type { MapOp, MapScene } from '../map/core/types'
import { applyCampaignOp, invertCampaignOp, metaOf, splitKey } from './campaign'
import { History } from './history'
import type { Campaign, CampaignDocs, CampaignMeta, CampaignOp, Change, DocKey } from './types'

/** A document to write in a snapshot; `null` — the document is deleted. */
export type DocWrite = [DocKey, unknown]

/** Where a session saves: the browser's database now, the server later. */
export interface SessionStorage {
  /** changes of one tab numbered from `from` on, in order */
  append(campaignId: string, tab: string, from: number, changes: Change[]): Promise<void>
  /** snapshots of changed documents; the journal of the tab up to `upto` is no longer needed */
  compact(campaignId: string, tab: string, upto: number, writes: DocWrite[], meta: CampaignMeta): Promise<void>
}

/** A pause after which the documents are written whole. */
const IDLE_MS = 3000
/** …or this many changes, whichever comes first. */
const MAX_JOURNAL = 300

// what a step edits, so that a quick series of the same edits is one step of the history
function mergeKey(ch: Change): string | null {
  if (!('op' in ch)) return null
  if (ch.doc === 'campaign') {
    const op = ch.op as CampaignOp
    if (op.type === 'rename') return 'rename'
    if (op.type === 'player.update') return `player:${op.id}:${Object.keys(op.patch).join()}`
    return null
  }
  const type = (ch.op as MapOp).type
  return type === 'grid' || type === 'name' ? `${ch.doc}:${type}` : null
}

export class CampaignSession {
  readonly id: string
  /** this tab: its journal is its own */
  readonly tab = newId()
  readonly history = new History()
  private doc: Campaign
  private maps = new Map<string, MapStore>()
  private unsubscribe = new Map<string, () => void>()
  private seats = new Map<string, Seat>()
  private listeners = new Set<() => void>()
  private version = 0
  // the journal: numbers of changes, what is not sent yet, what the snapshot covers
  private seq = 0
  private savedSeq = 0
  private pending: Change[] = []
  private dirty = new Set<DocKey>()
  private timer: ReturnType<typeof setTimeout> | null = null
  private saving: Promise<void> = Promise.resolve()
  // changes applied by the session itself are not recorded twice by the map listeners
  private applying = false
  private closed = false

  constructor(docs: CampaignDocs, private storage: SessionStorage) {
    this.id = docs.campaign.id
    this.doc = docs.campaign
    for (const [id, scene] of Object.entries(docs.maps)) this.addMap(id, scene)
    for (const [id, seat] of Object.entries(docs.seats)) this.seats.set(id, seat)
  }

  // ——— reading ———

  get campaign(): Campaign {
    return this.doc
  }

  /** The store of a map: the map view works with it directly. */
  map(id: string): MapStore | undefined {
    return this.maps.get(id)
  }

  seat(playerId: string): Seat | undefined {
    return this.seats.get(playerId)
  }

  /** All documents as they are now (the archive takes them). */
  docs(): CampaignDocs {
    const maps: Record<string, MapScene> = {}
    for (const [id, store] of this.maps) maps[id] = store.get()
    return { campaign: this.doc, maps, seats: Object.fromEntries(this.seats) }
  }

  /** What the home screen shows. */
  meta(): CampaignMeta {
    return metaOf(this.docs(), Date.now())
  }

  /** Every change since the last snapshot is in the journal; this says whether the snapshot is written too. */
  get saved() {
    return this.seq === this.savedSeq && !this.pending.length
  }

  // ——— changes ———

  /**
   * A user action: the changes in order, one step of «Отменить». `record: false` — changes
   * that are not undone (the game, a sheet edited by its player).
   */
  apply(changes: Change[], { record = true } = {}) {
    if (this.closed || !changes.length) return
    const backward: Change[] = []
    for (const ch of changes) {
      backward.unshift(...this.invert(ch))
      this.applyOne(ch)
    }
    if (record) this.history.record(changes, backward, changes.length === 1 ? mergeKey(changes[0]) : null)
    this.changed()
  }

  undo() {
    const step = this.history.takeUndo()
    if (step) this.replay(step.backward)
  }

  redo() {
    const step = this.history.takeRedo()
    if (step) this.replay(step.forward)
  }

  private replay(changes: Change[]) {
    for (const ch of changes) this.applyOne(ch)
    this.changed()
  }

  // the changes that take `ch` back, on the documents before it
  private invert(ch: Change): Change[] {
    const [kind, id] = splitKey(ch.doc)
    if (kind === 'campaign') {
      if ('op' in ch) return invertCampaignOp(this.doc, ch.op as CampaignOp).map((op) => ({ doc: 'campaign', op }))
      return [{ doc: 'campaign', set: this.doc }]
    }
    if (kind === 'map') {
      const store = this.maps.get(id)
      const doc = ch.doc as `map/${string}`
      if ('op' in ch) return store ? invertMapOp(store.get(), ch.op as MapOp).map((op) => ({ doc, op })) : []
      if (store) return [{ doc, set: store.get() }]
      return 'set' in ch ? [{ doc, drop: true }] : []
    }
    if (kind === 'seat') {
      const prev = this.seats.get(id)
      if (prev) return [{ doc: ch.doc, set: prev }]
      return 'set' in ch ? [{ doc: ch.doc, drop: true }] : []
    }
    return []
  }

  private applyOne(ch: Change) {
    const [kind, id] = splitKey(ch.doc)
    if (kind === 'map') {
      const store = this.maps.get(id)
      if ('op' in ch) {
        if (!store) return
        // the map listener journals it
        this.applying = true
        try {
          store.dispatch(ch.op as MapOp)
        } finally {
          this.applying = false
        }
        return
      }
      if ('set' in ch) {
        const scene = ch.set as MapScene
        if (store) {
          this.applying = true
          try {
            store.dispatch({ type: 'scene', scene })
          } finally {
            this.applying = false
          }
          return
        }
        this.addMap(id, scene)
      } else {
        this.unsubscribe.get(id)?.()
        this.unsubscribe.delete(id)
        this.maps.delete(id)
      }
    } else if (kind === 'campaign') {
      this.doc = 'op' in ch ? applyCampaignOp(this.doc, ch.op as CampaignOp) : 'set' in ch ? (ch.set as Campaign) : this.doc
    } else if (kind === 'seat') {
      if ('set' in ch) this.seats.set(id, ch.set as Seat)
      else this.seats.delete(id)
    } else return
    this.journal(ch)
  }

  private addMap(id: string, scene: MapScene) {
    const store = new MapStore(scene)
    const doc = `map/${id}` as const
    this.maps.set(id, store)
    // the map view changes its store itself: every operation is saved, and the editor's ones undone
    this.unsubscribe.set(id, store.subscribe((_, op, __, prev) => {
      this.journal({ doc, op })
      if (this.applying) return
      const step: Change = { doc, op }
      this.history.record([step], invertMapOp(prev, op).map((o) => ({ doc, op: o })), mergeKey(step))
      this.changed()
    }))
  }

  // ——— saving ———

  private journal(ch: Change) {
    this.dirty.add(ch.doc)
    this.pending.push(ch)
    if (this.pending.length === 1) queueMicrotask(() => this.flushJournal())
  }

  private flushJournal() {
    if (!this.pending.length) return
    const changes = this.pending
    const from = this.seq + 1
    this.pending = []
    this.seq += changes.length
    this.saving = this.saving.then(() => this.storage.append(this.id, this.tab, from, changes)).catch((e) => console.error('journal', e))
    if (this.timer) clearTimeout(this.timer)
    if (this.seq - this.savedSeq >= MAX_JOURNAL) void this.save()
    else this.timer = setTimeout(() => void this.save(), IDLE_MS)
  }

  /** Writes the changed documents whole («Сохранить», a pause, closing). */
  save(): Promise<void> {
    if (this.closed) return this.saving
    this.flushJournal()
    if (this.timer) clearTimeout(this.timer)
    this.timer = null
    if (!this.dirty.size && this.seq === this.savedSeq) return this.saving
    const writes: DocWrite[] = [...this.dirty].map((key) => [key, this.valueOf(key)])
    const upto = this.seq
    const meta = this.meta()
    this.dirty.clear()
    this.saving = this.saving
      .then(() => this.storage.compact(this.id, this.tab, upto, writes, meta))
      .then(() => {
        this.savedSeq = Math.max(this.savedSeq, upto)
        this.changed()
      })
      .catch((e) => console.error('snapshot', e))
    return this.saving
  }

  private valueOf(key: DocKey): unknown {
    const [kind, id] = splitKey(key)
    if (kind === 'campaign') return this.doc
    if (kind === 'map') return this.maps.get(id)?.get() ?? null
    if (kind === 'seat') return this.seats.get(id) ?? null
    return null
  }

  /** Saves and stops: the screen that opened the campaign is gone. */
  async close() {
    if (this.closed) return this.saving
    await this.save()
    this.stop()
  }

  /**
   * Stops without writing what is not saved yet (the campaign is being deleted); resolves when
   * the writes already sent are done.
   */
  discard(): Promise<void> {
    this.pending = []
    this.dirty.clear()
    this.stop()
    return this.saving
  }

  private stop() {
    if (this.timer) clearTimeout(this.timer)
    this.timer = null
    this.closed = true
    for (const off of this.unsubscribe.values()) off()
    this.unsubscribe.clear()
    this.listeners.clear()
  }

  // ——— listeners (React reads the version) ———

  subscribe = (fn: () => void) => {
    this.listeners.add(fn)
    return () => {
      this.listeners.delete(fn)
    }
  }

  getVersion = () => this.version

  private changed() {
    this.version++
    for (const fn of this.listeners) fn()
  }
}
