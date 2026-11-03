import { applyOp } from './scene'
import type { MapOp, MapScene } from './types'

/** 'local': made on this device (send it to the others); 'remote': came from the network. */
export type OpSource = 'local' | 'remote'

export type StoreListener = (scene: MapScene, op: MapOp, source: OpSource) => void

/**
 * Holds the current map and applies operations. The renderer, the panels and (later) the
 * network all subscribe to the same store.
 */
export class MapStore {
  private scene: MapScene
  private listeners = new Set<StoreListener>()

  constructor(scene: MapScene) {
    this.scene = scene
  }

  get = () => this.scene

  dispatch(op: MapOp, source: OpSource = 'local') {
    this.scene = applyOp(this.scene, op)
    for (const fn of this.listeners) fn(this.scene, op, source)
  }

  subscribe = (fn: StoreListener) => {
    this.listeners.add(fn)
    return () => {
      this.listeners.delete(fn)
    }
  }
}
