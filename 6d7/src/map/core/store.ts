import { applyOp } from './scene'
import type { MapOp, MapScene } from './types'

/** 'local': made on this device (send it to the others); 'remote': came from the network. */
export type OpSource = 'local' | 'remote'

/** `prev` — the scene before the operation (the history of the editor takes it back from there). */
export type StoreListener = (scene: MapScene, op: MapOp, source: OpSource, prev: MapScene) => void

/**
 * Holds the current map and applies operations. The renderer, the panels, the campaign (saving,
 * history) and (later) the network all subscribe to the same store.
 */
export class MapStore {
  private scene: MapScene
  private listeners = new Set<StoreListener>()

  constructor(scene: MapScene) {
    this.scene = scene
  }

  get = () => this.scene

  dispatch(op: MapOp, source: OpSource = 'local') {
    const prev = this.scene
    this.scene = applyOp(prev, op)
    for (const fn of this.listeners) fn(this.scene, op, source, prev)
  }

  subscribe = (fn: StoreListener) => {
    this.listeners.add(fn)
    return () => {
      this.listeners.delete(fn)
    }
  }
}
