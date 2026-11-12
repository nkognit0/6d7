// What players have seen on the active map of the game, kept by the master's tab as the server
// will keep it: every operation on the map of the game reveals or closes (`trackExplored`), whatever
// the master's screen shows (another map looked at, a tab in the background). Saved in pauses.
// (the core paths, not the map's index with its renderer: this goes to the server)
import { exploredKey } from '../../campaign/game'
import type { CampaignSession } from '../../campaign/session'
import { ExploredMask, type ExploredData } from '../../map/core/explored'
import { trackExplored, type ExploredTracker } from '../../map/core/exploring'
import type { MapStore } from '../../map/core/store'

/** The mask is written this long after players stop discovering the map. */
const SAVE_MS = 2000

export class ExploredKeeper {
  private mapId: string | null = null
  private store: MapStore | null = null
  private mask: ExploredMask | null = null
  // the saved mask the live one started from or wrote last: another one means an import or a new start
  private doc: ExploredData | undefined
  private settings: unknown
  private tracker: ExploredTracker | null = null
  private offMask: (() => void) | null = null
  private offSession: (() => void) | null = null
  private timer: ReturnType<typeof setTimeout> | null = null
  private syncing = false

  constructor(private session: CampaignSession) {}

  /** Starts keeping (and keeps until the returned function): the screen of the game mounts it. */
  attach(): () => void {
    this.offSession?.()
    this.offSession = this.session.subscribe(() => this.sync())
    this.sync()
    return () => {
      this.offSession?.()
      this.offSession = null
      this.flush()
      this.drop()
    }
  }

  /** The live mask of a map of the game: only the active one has it, and only while attached. */
  of(mapId: string): ExploredMask | null {
    return mapId === this.mapId ? this.mask : null
  }

  // follows the active map, its picture and its saved mask
  private sync() {
    // saving a mask changes the session: the change comes back here
    if (!this.offSession || this.syncing) return
    this.syncing = true
    try {
      this.follow()
    } finally {
      this.syncing = false
    }
  }

  private follow() {
    const session = this.session
    const id = session.gameDoc?.active ?? null
    const store = id ? (session.gameMap(id)?.store ?? null) : null
    const image = store?.get().image ?? null
    const doc = id ? session.exploredOf(id) : undefined
    const same = id === this.mapId && store === this.store && this.mask && image?.width === this.mask.image.width && image?.height === this.mask.image.height
    if (same && doc === this.doc) {
      if (session.campaign.settings !== this.settings) {
        this.settings = session.campaign.settings
        this.tracker?.update()
      }
      return
    }
    // another map: what is not saved yet is written; the same map with another saved mask or
    // picture (a start took the editor's edits, a state was imported): the new one wins
    if (id !== this.mapId) this.flush()
    this.drop()
    this.mapId = id
    this.store = store
    if (!id || !store || !image) return
    this.doc = doc
    this.settings = session.campaign.settings
    const mask = new ExploredMask(image, doc)
    this.mask = mask
    this.offMask = mask.subscribe(() => {
      if (this.timer) clearTimeout(this.timer)
      this.timer = setTimeout(() => this.flush(), SAVE_MS)
    })
    this.tracker = trackExplored(store, mask, () => session.campaign.settings)
  }

  private flush() {
    if (!this.timer) return
    clearTimeout(this.timer)
    this.timer = null
    if (!this.mask || !this.mapId) return
    const data = this.mask.save()
    this.doc = data
    this.session.apply([{ doc: exploredKey(this.mapId), set: data }], { record: false })
  }

  private drop() {
    if (this.timer) clearTimeout(this.timer)
    this.timer = null
    this.tracker?.stop()
    this.offMask?.()
    this.tracker = null
    this.offMask = null
    this.mask = null
    this.mapId = null
    this.store = null
    this.doc = undefined
  }
}
