import { useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import {
  Button, ColorIcon, Icon, IconButton, NavTab, NpcCard, NumberField, PLAYER_COLORS, PlayerIcon, RowField, RowSubtitle, RowSwitch,
  RowTabs, RowTitle, ScrollArea, Select, SidebarSection, Slider
} from '../../ui'
import {
  createScene, createTestMap, importMapImage, MAP_IMAGE_ACCEPT, MapImageError, MapStore, MapView, MAX_IMAGE_SIDE, MemoryTileProvider,
  newId, PX_PER_GRID_UNIT, rulesOf, useMapScene, type FlowColor, type ImportedImage, type ImportProgress, type MapEngine, type MapRole,
  type MapScene, type MapStats, type MapTool, type MapViewState, type TestMapLayout, type Token, type ZoomInfo
} from '../../map'
import { useStrings } from '../../i18n'
import styles from './MapPrototype.module.css'

// texts of the page from the language catalog, under the names the page uses
function usePageText() {
  const s = useStrings()
  const m = s.editor.maps
  return {
    ...s.mapPrototype,
    editing: m.editing, zoomOut: m.zoomOut, zoomIn: m.zoomIn, zoomField: m.zoomField, fit: m.fit, upload: m.uploadImage,
    grid: m.grid, gridSize: m.gridSize, gridX: m.gridX, gridY: m.gridY, objects: m.objects, spawn: m.spawn, wall: m.wall,
    barrier: m.barrier, door: m.door, buildEraser: m.objectsEraser, fog: m.fog, fogBrush: m.fogBrush, fogSize: m.brushSize,
    fogEraser: m.fogEraser, fogCover: m.fogCover, fogClear: m.fogClear, rules: m.conditions, freeMove: m.freeMovement,
    freeDoors: m.freeDoors, darkness: m.darkness, dynamicFog: m.dynamicFog, npc: m.npc,
    drawing: s.master.drawing, pencil: s.master.pencil, drawEraser: s.master.eraser,
    reading: m.imageReading, cutting: m.imageCutting, errFormat: m.imageErrFormat, errDecode: m.imageErrDecode,
    errSize: m.imageErrSize(MAX_IMAGE_SIDE), rarity: s.rarity
  }
}

// sample players of the prototype: names the master would type
const NAMES: Record<FlowColor, string> = {
  red: 'Арина', orange: 'Борис', yellow: 'Вера', green: 'Глеб', blue: 'Дарья', indigo: 'Егор', purple: 'Жанна', scarlett: 'Захар'
}

const NPC = (['common', 'rare', 'legendary'] as const).map((r) => ({
  rarity: r,
  name: 'Гоблин',
  image: `${import.meta.env.BASE_URL}tokens/npc-goblin-${r}.webp`
}))

const playerToken = (c: FlowColor): Omit<Token, 'pin'> => ({ id: c, kind: 'player', name: NAMES[c], color: c })

// a generated dungeon becomes a ready scene: grid, walls, doors, spawn, fog and one player
function testScene(img: ImportedImage & { layout: TestMapLayout }, name: string): MapScene {
  const { layout } = img
  const base = createScene(name)
  const grid = { ...base.grid, size: layout.cellPx / PX_PER_GRID_UNIT }
  const node = (u: number, v: number) => ({ space: 'grid' as const, u, v })
  const walls = layout.walls.map(([u1, v1, u2, v2]) => ({ id: newId(), kind: 'wall' as const, a: node(u1, v1), b: node(u2, v2) }))
  const wallOf = new Map(layout.walls.map((w, i) => [w.join(), walls[i].id]))
  const doors = layout.doors.map(([u1, v1, u2, v2]) => ({ id: newId(), wallId: wallOf.get([u1, v1, u2, v2].join())!, a: node(u1, v1), b: node(u2, v2), open: false }))
  const spawn = { space: 'grid' as const, u: layout.spawn[0] + 0.5, v: layout.spawn[1] + 0.5 }
  return {
    ...base,
    image: img.info,
    grid,
    walls,
    doors,
    spawn,
    fog: [{ id: newId(), mode: 'cover' }],
    tokens: [{ ...playerToken('orange'), pin: spawn, darkvision: 60 }]
  }
}

/** The map prototype: the real map module inside a page that imitates the editor panel. */
export function MapPrototype() {
  const tiles = useMemo(() => new MemoryTileProvider(), [])
  const text = usePageText()
  const store = useMemo(() => new MapStore(createScene()), [])
  const scene = useMapScene(store)
  const engine = useRef<MapEngine | null>(null)
  const file = useRef<HTMLInputElement>(null)
  const [zoom, setZoom] = useState<ZoomInfo | null>(null)
  const [zoomText, setZoomText] = useState<string | null>(null)
  const [stats, setStats] = useState<MapStats | null>(null)
  const [role, setRole] = useState<MapRole>('master')
  const [me, setMe] = useState<FlowColor>('orange')
  const [tool, setTool] = useState<MapTool>('select')
  const [brush, setBrush] = useState(4)
  const [selected, setSelected] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loaded, setLoaded] = useState<ImportedImage | null>(null)
  const [panel, setPanel] = useState(false)

  const master = role === 'master'
  const view = useMemo<MapViewState>(() => ({ role, playerId: me, drawColor: master ? 'master' : me, tool, brush }), [role, me, master, tool, brush])
  const dispatch = store.dispatch.bind(store)
  const pick = (t: MapTool) => setTool(tool === t ? 'select' : t)
  const token = scene.tokens.find((t) => t.id === selected) ?? null
  const rules = rulesOf(scene)

  const progress: ImportProgress = (stage, f) =>
    setBusy(stage === 'decode' ? text.reading : stage === 'draw' ? text.drawingMap : text.cutting(Math.round(f * 100)))

  const load = async (job: () => Promise<void>) => {
    setError(null)
    try {
      await job()
    } catch (e) {
      const code = e instanceof MapImageError ? e.code : 'other'
      setError(code === 'format' ? text.errFormat : code === 'decode' ? text.errDecode : code === 'size' ? text.errSize : String(e))
    } finally {
      setBusy(null)
    }
  }

  const upload = (f: File) =>
    load(async () => {
      const img = await importMapImage(f, tiles, progress)
      setLoaded(img)
      setSelected(null)
      dispatch({ type: 'scene', scene: { ...createScene(f.name), image: img.info } })
    })

  const test = (cells: number) =>
    load(async () => {
      const img = await createTestMap({ cols: cells, rows: cells, cellPx: 100 }, tiles, progress)
      setLoaded(img)
      setSelected(null)
      dispatch({ type: 'scene', scene: testScene(img, text.testMapName) })
    })

  const dragIn = (make: () => Omit<Token, 'pin'>) => (e: ReactPointerEvent) => {
    e.preventDefault()
    engine.current?.dragToken(make(), e.nativeEvent)
  }

  const commitZoom = () => {
    const n = Number(zoomText?.replace(',', '.').replace('%', ''))
    if (zoomText !== null && Number.isFinite(n) && n > 0) engine.current?.zoomTo(n)
    setZoomText(null)
  }

  const s = stats
  return (
    <div className={styles.page}>
      <div className={styles.stage}>
        <MapView
          store={store}
          tiles={tiles}
          view={view}
          onEngine={(e) => (engine.current = e)}
          onZoom={setZoom}
          onStats={setStats}
          onSelect={setSelected}
        />
        <div className={styles.stats}>
          {s && <span>{text.frame(s.frameMs.toFixed(1), s.fps)}</span>}
          {s && scene.image && <span>{text.tiles(s.tiles, s.tileMB.toFixed(0), s.level, Math.max(0, s.levels - 1))}</span>}
          {s && <span>{text.vision(s.visionMs.toFixed(1), s.dpr)}</span>}
          {loaded && (
            <span>{text.mapInfo(loaded.info.width, loaded.info.height, loaded.format?.toUpperCase() ?? '', (loaded.ms / 1000).toFixed(1), (loaded.bytes / 1048576).toFixed(0))}</span>
          )}
        </div>
        <IconButton className={styles.panelToggle} variant="switch" pressed={panel} label={text.panel} icon={<Icon name="more.three.dots" />} onClick={() => setPanel(!panel)} />
      </div>

      <aside className={panel ? `${styles.panel} ${styles.open}` : styles.panel}>
        <ScrollArea className={styles.scroll}>
          <SidebarSection>
            <a className={styles.back} href="#preview">{text.back}</a>
            <RowTabs stretch>
              <NavTab selected={master} onClick={() => setRole('master')}>{text.master}</NavTab>
              <NavTab selected={!master} onClick={() => setRole('player')}>{text.player}</NavTab>
            </RowTabs>
            {!master && (
              <RowField label={text.me}>
                <Select value={me} onChange={setMe} options={PLAYER_COLORS.map((c) => ({ value: c as FlowColor, label: NAMES[c as FlowColor] }))} />
              </RowField>
            )}
          </SidebarSection>

          <SidebarSection>
            <RowTitle
              title={text.editing}
              action={
                <span className={styles.zoom}>
                  <IconButton label={text.zoomOut} icon={<Icon name="minus" />} disabled={!zoom || zoom.percent <= zoom.min + 0.05} onClick={() => engine.current?.zoomBy(0.5)} />
                  <input
                    className={styles.zoomInput}
                    aria-label={text.zoomField}
                    value={zoomText ?? (zoom ? `${Math.round(zoom.percent)}%` : '')}
                    onChange={(e) => setZoomText(e.target.value)}
                    onFocus={(e) => e.target.select()}
                    onBlur={commitZoom}
                    onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                  />
                  <IconButton label={text.zoomIn} icon={<Icon name="plus" />} disabled={!zoom || zoom.percent >= zoom.max - 0.05} onClick={() => engine.current?.zoomBy(2)} />
                </span>
              }
            />
            {scene.image && <Button variant="secondary" stretch onClick={() => engine.current?.fitMap()}>{text.fit}</Button>}
            {master && (
              <>
                <Button stretch disabled={!!busy} icon={<Icon name="arrows.upload" />} onClick={() => file.current?.click()}>{text.upload}</Button>
                <input ref={file} type="file" accept={MAP_IMAGE_ACCEPT} hidden onChange={(e) => {
                  const f = e.target.files?.[0]
                  e.target.value = ''
                  if (f) upload(f)
                }} />
                <div className={styles.pair}>
                  <Button variant="secondary" stretch disabled={!!busy} onClick={() => test(40)}>{text.test4k}</Button>
                  <Button variant="secondary" stretch disabled={!!busy} onClick={() => test(100)}>{text.test10k}</Button>
                </div>
                {busy && <p className={styles.note}>{busy}</p>}
                {error && <p className={styles.error}>{error}</p>}
              </>
            )}
          </SidebarSection>

          {master && (
            <SidebarSection>
              <RowSwitch label={text.grid} checked={scene.grid.enabled} onChange={(v) => dispatch({ type: 'grid', patch: { enabled: v } })} />
              <div className={styles.pair}>
                <NumberField label={text.gridSize} value={scene.grid.size} min={1} max={10} step={0.01}
                  onChange={(v) => dispatch({ type: 'grid', patch: { size: v } })} />
              </div>
              <div className={styles.pair}>
                <NumberField label={text.gridX} value={scene.grid.offsetX} onChange={(v) => dispatch({ type: 'grid', patch: { offsetX: v } })} />
                <NumberField label={text.gridY} scrub="y" value={scene.grid.offsetY} onChange={(v) => dispatch({ type: 'grid', patch: { offsetY: v } })} />
              </div>
            </SidebarSection>
          )}

          {master && scene.image && (
            <>
              <SidebarSection>
                <RowSubtitle>{text.objects}</RowSubtitle>
                <div className={styles.tools}>
                  <IconButton stretch variant="switch" pressed={tool === 'spawn'} label={text.spawn} icon={<Icon name="home" />} onClick={() => pick('spawn')} />
                  <IconButton stretch variant="switch" pressed={tool === 'wall'} label={text.wall} icon={<Icon name="wall.bricks" />} onClick={() => pick('wall')} />
                  <IconButton stretch variant="switch" pressed={tool === 'barrier'} label={text.barrier} icon={<Icon name="wall.barrier" />} onClick={() => pick('barrier')} />
                  <IconButton stretch variant="switch" pressed={tool === 'door'} label={text.door} icon={<Icon name="door" />} onClick={() => pick('door')} />
                  <IconButton stretch variant="switch" pressed={tool === 'build-erase'} label={text.buildEraser} icon={<Icon name="eraser" />} onClick={() => pick('build-erase')} />
                </div>
              </SidebarSection>

              <SidebarSection>
                <RowSubtitle>{text.fog}</RowSubtitle>
                <div className={styles.brush}>
                  <IconButton variant="switch" pressed={tool === 'fog-paint'} label={text.fogBrush} icon={<Icon name="fog.of.war" />} onClick={() => pick('fog-paint')} />
                  <Slider value={brush} min={1} max={20} onChange={setBrush} aria-label={text.fogSize} />
                  <IconButton variant="switch" pressed={tool === 'fog-erase'} label={text.fogEraser} icon={<Icon name="eraser" />} onClick={() => pick('fog-erase')} />
                </div>
                <div className={styles.pair}>
                  <Button variant="secondary" stretch onClick={() => dispatch({ type: 'fog.add', stroke: { id: newId(), mode: 'cover' } })}>{text.fogCover}</Button>
                  <Button variant="secondary" stretch onClick={() => dispatch({ type: 'fog.clear' })}>{text.fogClear}</Button>
                </div>
              </SidebarSection>

              <SidebarSection>
                <RowSubtitle>{text.rules}</RowSubtitle>
                <RowSwitch label={text.freeMove} checked={rules.freeMove} onChange={(v) => dispatch({ type: 'rules', patch: { freeMove: v } })} />
                {rules.freeMove && <RowSwitch label={text.freeDoors} checked={rules.freeDoors} onChange={(v) => dispatch({ type: 'rules', patch: { freeDoors: v } })} />}
                <RowSwitch label={text.darkness} checked={rules.darkness} onChange={(v) => dispatch({ type: 'rules', patch: { darkness: v } })} />
                <RowSwitch label={text.dynamicFog} checked={rules.dynamicFog} onChange={(v) => dispatch({ type: 'rules', patch: { dynamicFog: v } })} />
              </SidebarSection>
            </>
          )}

          {scene.image && (
            <SidebarSection>
              <RowSubtitle>{text.tokens}</RowSubtitle>
              <div className={styles.players}>
                {(master ? (PLAYER_COLORS as FlowColor[]) : [me]).map((c) => {
                  const onMap = scene.tokens.some((t) => t.id === c)
                  return (
                    <button key={c} type="button" className={styles.drag} title={NAMES[c]} aria-label={NAMES[c]}
                      disabled={!master && onMap} onPointerDown={dragIn(() => playerToken(c))}>
                      <PlayerIcon name="character.figure.avatar" color={c} />
                    </button>
                  )
                })}
              </div>
              {master && (
                <>
                  <RowSubtitle tone="secondary">{text.npc}</RowSubtitle>
                  {NPC.map((n) => (
                    <NpcCard key={n.rarity} layout="list" image={n.image} name={n.name} note={text.rarity[n.rarity]} className={styles.dragCard}
                      onPointerDown={dragIn(() => ({ id: newId(), kind: 'npc', name: n.name, image: n.image }))} />
                  ))}
                </>
              )}
            </SidebarSection>
          )}

          {token && (master || token.id === me) && (
            <SidebarSection>
              <RowSubtitle>{text.tokenTitle(token.name)}</RowSubtitle>
              {token.kind === 'player' && (
                <>
                  <RowField label={text.darkvision}>
                    <Select value={String(token.darkvision ?? 0)} onChange={(v) => dispatch({ type: 'token.update', id: token.id, patch: { darkvision: Number(v) } })}
                      options={['0', '60', '120'].map((v) => ({ value: v, label: text.feet(Number(v)) }))} />
                  </RowField>
                  <RowField label={text.light}>
                    <Select value={String(token.light ?? 0)} onChange={(v) => dispatch({ type: 'token.update', id: token.id, patch: { light: Number(v) } })}
                      options={[{ value: '0', label: text.noLight }, { value: '40', label: text.torch }]} />
                  </RowField>
                </>
              )}
              {master && <Button variant="secondary" stretch onClick={() => {
                dispatch({ type: 'token.remove', id: token.id })
                setSelected(null)
              }}>{text.remove}</Button>}
            </SidebarSection>
          )}

          {scene.image && (
            <SidebarSection>
              <RowSubtitle>{text.drawing}</RowSubtitle>
              <div className={styles.tools}>
                <IconButton stretch variant="switch" pressed={tool === 'pencil'} label={text.pencil}
                  icon={<PlayerIcon name="character.pencil" color={master ? 'grey' : me} />} onClick={() => pick('pencil')} />
                <IconButton stretch variant="switch" pressed={tool === 'draw-erase'} label={text.drawEraser} icon={<ColorIcon name="character.eraser" />} onClick={() => pick('draw-erase')} />
              </div>
              <Button variant="secondary" stretch onClick={() => {
                const author = master ? 'master' : me
                dispatch({ type: 'draw.remove', ids: scene.drawings.filter((d) => d.author === author).map((d) => d.id) })
              }}>{text.clearMine}</Button>
            </SidebarSection>
          )}
        </ScrollArea>
      </aside>
    </div>
  )
}
