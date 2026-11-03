import { useEffect, useRef } from 'react'
import { cx } from '../../ui'
import type { MapStore } from '../core/store'
import type { TileProvider } from '../core/types'
import { MapEngine, type MapStats, type MapViewState, type ZoomInfo } from '../engine/MapEngine'
import styles from './MapView.module.css'

export interface MapViewProps {
  store: MapStore
  tiles: TileProvider
  view: MapViewState
  /** the engine for imperative calls (zoom buttons, dragging tokens in); null on unmount */
  onEngine?: (engine: MapEngine | null) => void
  onZoom?: (zoom: ZoomInfo) => void
  onStats?: (stats: MapStats) => void
  onSelect?: (tokenId: string | null) => void
  className?: string
}

/** The map canvas. Fills its parent; the interface is laid over it by the screen. */
export function MapView({ store, tiles, view, className, ...callbacks }: MapViewProps) {
  const host = useRef<HTMLDivElement>(null)
  const engine = useRef<MapEngine | null>(null)
  const latest = useRef({ view, callbacks })
  latest.current = { view, callbacks }

  useEffect(() => {
    const e = new MapEngine(host.current!, {
      store,
      tiles,
      view: latest.current.view,
      onZoom: (z) => latest.current.callbacks.onZoom?.(z),
      onStats: (s) => latest.current.callbacks.onStats?.(s),
      onSelect: (id) => latest.current.callbacks.onSelect?.(id)
    })
    engine.current = e
    let alive = true
    e.init().then(() => {
      if (alive) latest.current.callbacks.onEngine?.(e)
    })
    return () => {
      alive = false
      latest.current.callbacks.onEngine?.(null)
      e.destroy()
      engine.current = null
    }
  }, [store, tiles])

  useEffect(() => {
    engine.current?.setView(view)
  }, [view])

  return <div ref={host} className={cx(styles.host, className)} />
}

