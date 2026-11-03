import { useSyncExternalStore } from 'react'
import type { MapStore } from '../core/store'
import type { MapScene } from '../core/types'

/** The current map of a store, for panels (re-renders on every change). */
export function useMapScene(store: MapStore): MapScene {
  return useSyncExternalStore(store.subscribe, store.get)
}
