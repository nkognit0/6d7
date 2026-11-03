import { useEffect, useMemo, useRef, useState } from 'react'
import { go } from '../../app/route'
import { useShortcuts } from '../../app/shortcuts'
import { mapKey, repo, type CampaignSession } from '../../campaign'
import { useStrings } from '../../i18n'
import { MapView, useMapScene, type MapEngine, type MapOp, type MapStore, type MapTool, type MapViewState, type ZoomInfo } from '../../map'
import type { EditorMode } from '../EditorScreen'
import { MapList } from './MapList'
import { MapPanel } from './MapPanel'
import { NpcDialog } from './NpcDialog'
import styles from './Maps.module.css'

// a click on a token, not a drag: the pointer moved less than this (px)
const TAP = 6

/**
 * D&D VTT / editor / maps (6:400, 6:421, 40:2994): the maps of the campaign on the left, the map
 * in the middle, its settings on the right. The open map is in the address.
 */
export function MapsTab({ session, mode, mapId }: { session: CampaignSession; mode: EditorMode; mapId?: string }) {
  const s = useStrings()
  const order = session.campaign.maps
  const current = mapId && order.includes(mapId) ? mapId : (order[0] ?? null)
  const select = (id: string | undefined, replace = false) => go({ page: 'editor', campaign: session.id, tab: 'maps', map: id }, { replace })

  // a deleted or unknown map: the first one opens instead
  useEffect(() => {
    if (current !== (mapId ?? null)) select(current ?? undefined, true)
  })

  const store = current ? session.map(current) : undefined
  return (
    <div className={styles.layout}>
      <MapList session={session} selected={current} onSelect={(id) => select(id)} />
      {store && current ? (
        <MapEditor key={current} session={session} mapId={current} store={store} mode={mode} />
      ) : (
        <>
          <p className={styles.noMaps}>{s.editor.maps.noMaps}</p>
          <MapPanel session={session} scene={null} dispatch={() => {}} engine={null} zoom={null} tool="select" onTool={() => {}} brush={4} onBrush={() => {}} />
        </>
      )}
    </div>
  )
}

/** One open map: the canvas and the panel share the engine, the tool and the brush. */
function MapEditor({ session, mapId, store, mode }: { session: CampaignSession; mapId: string; store: MapStore; mode: EditorMode }) {
  const scene = useMapScene(store)
  const [engine, setEngine] = useState<MapEngine | null>(null)
  const [zoom, setZoom] = useState<ZoomInfo | null>(null)
  const [tool, setTool] = useState<MapTool>('select')
  const [brush, setBrush] = useState(4)
  const [selected, setSelected] = useState<string | null>(null)
  const [dialog, setDialog] = useState<{ id: string; x: number; y: number } | null>(null)
  const down = useRef<{ x: number; y: number } | null>(null)
  const chosen = useRef<string | null>(null)

  const settings = session.campaign.settings
  const view = useMemo<MapViewState>(
    () => ({ role: 'master', look: mode === 'player' ? 'player' : 'master', playerId: 'master', drawColor: 'master', tool, brush, campaignRules: settings }),
    [mode, tool, brush, settings]
  )
  // map edits go through the store: the campaign saves and records them
  const dispatch = (op: MapOp) => session.apply([{ doc: mapKey(mapId), op }])

  const token = dialog ? scene.tokens.find((t) => t.id === dialog.id) : undefined
  const selectedNpc = scene.tokens.find((t) => t.id === selected && t.kind === 'npc')

  useShortcuts('editor', {
    remove: selectedNpc
      ? () => {
          setDialog(null)
          dispatch({ type: 'token.remove', id: selectedNpc.id })
        }
      : undefined
  })

  return (
    <>
      <div
        className={styles.stage}
        onPointerDown={(e) => {
          down.current = { x: e.clientX, y: e.clientY }
          setDialog(null)
        }}
        onPointerUp={(e) => {
          // a click on an NPC opens its window; a drag only moves it
          const d = down.current
          down.current = null
          if (!d || Math.hypot(e.clientX - d.x, e.clientY - d.y) >= TAP || tool !== 'select') return
          const t = store.get().tokens.find((x) => x.id === chosen.current)
          if (t?.kind === 'npc') setDialog({ id: t.id, x: e.clientX, y: e.clientY })
        }}
      >
        <MapView
          store={store}
          tiles={repo.tiles}
          view={view}
          onEngine={setEngine}
          onZoom={setZoom}
          onSelect={(id) => {
            chosen.current = id
            setSelected(id)
          }}
        />
      </div>
      <MapPanel
        session={session}
        scene={scene}
        dispatch={dispatch}
        engine={engine}
        zoom={zoom}
        tool={tool}
        onTool={setTool}
        brush={brush}
        onBrush={setBrush}
      />
      {dialog && token && <NpcDialog key={token.id} session={session} mapId={mapId} token={token} at={dialog} onClose={() => setDialog(null)} />}
    </>
  )
}
