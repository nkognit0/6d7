import { autoDetectRenderer, Container, Graphics, RenderTexture, Sprite, type Renderer } from 'pixi.js'
import {
  cellPx, dist, distToPolyline, distToSegment, imagePin, imageToGrid, newId, nodePin, pinToImage, projectT, samePin
} from '../core/geometry'
import type { MapStore } from '../core/store'
import { rulesOf } from '../core/scene'
import type { Door, FlowColor, MapRules, MapScene, Pin, RuleOverrides, Token, TileProvider, Vec } from '../core/types'
import { moveBlockers, pathBlocked } from '../core/visibility'
import { ExploredMask } from '../core/explored'
import { doorSeen, playerSight, playersSee, trackExplored, type ExploredTracker } from '../core/exploring'
import { placeTaken, snapTokenCenter, tokenCenter, tokenPinAt, tokenSize } from '../core/tokens'
import { BuildLayer, spawnRadius, strokeWalls, type SpawnState } from './BuildLayer'
import { Camera, CELL_AT_100, type CameraBounds } from './camera'
import { DrawLayer, drawingPaint, PENCIL } from './DrawLayer'
import { FogLayer } from './FogLayer'
import { GridLayer, SPOT_CELLS } from './GridLayer'
import { readTheme, type MapTheme } from './theme'
import { TileLayer } from './TileLayer'
import { TOKEN_COMPACT_PERCENT, TokenLayer } from './TokenLayer'

export type MapRole = 'master' | 'player'

/** select: move tokens, open doors, pan. The rest are the tools of the editor and the game. */
export type MapTool = 'select' | 'wall' | 'barrier' | 'door' | 'spawn' | 'build-erase' | 'fog-paint' | 'fog-erase' | 'pencil' | 'draw-erase'

const PLAYER_TOOLS: MapTool[] = ['select', 'pencil', 'draw-erase']

export interface MapViewState {
  /** what the user may do */
  role: MapRole
  /** how the map looks (the editor's «Глазами игрока»: a master who sees what players see); `role` by default */
  look?: MapRole
  /** who draws and whose token is "own" */
  playerId: string
  drawColor: FlowColor | 'master'
  tool: MapTool
  /** fog brush 1–20: diameter in half cells */
  brush: number
  /** settings of the campaign: the map follows them where it did not change them itself */
  campaignRules?: RuleOverrides
  /** the campaign editor: the master selects and drags the spawn point (in the game it stays put) */
  editor?: boolean
}

export interface MapStats {
  /** CPU time of the last frame */
  frameMs: number
  /** frames in the last second (0 when nothing moves) */
  fps: number
  tiles: number
  tileMB: number
  level: number
  levels: number
  dpr: number
  /** time of the last line-of-sight update */
  visionMs: number
}

export interface ZoomInfo {
  percent: number
  min: number
  max: number
}

export interface MapEngineOptions {
  store: MapStore
  tiles: TileProvider
  view: MapViewState
  onZoom?: (zoom: ZoomInfo) => void
  onStats?: (stats: MapStats) => void
  onSelect?: (tokenId: string | null) => void
  /** a right click with a tool (and no wall line going): the screen drops the tool */
  onToolEnd?: () => void
  /**
   * What players have seen on this map: the game keeps it up to date (`trackExplored`) and saves
   * it, the engine only shows it. Without it the engine keeps its own while it lives.
   */
  explored?: ExploredMask
}

type NewDoor = Omit<Door, 'id' | 'open'>

type Gesture =
  | { kind: 'pan'; id: number; last: Vec; down: Vec; button: number }
  | { kind: 'pinch'; startDist: number; startScale: number; anchor: Vec }
  | { kind: 'token'; id: number; tokenId: string; down: Vec; moved: boolean; pin: Pin }
  | { kind: 'door'; id: number; doorId: string; down: Vec }
  /** the door tool: a click puts one door, a drag along the wall stretches it over every cell it passes */
  | { kind: 'door-place'; id: number; first: NewDoor; span: NewDoor }
  /** the spawn point dragged (the select tool in the editor) or put (the spawn tool) */
  | { kind: 'spawn'; id: number; down: Vec; moved: boolean }
  | { kind: 'wall'; id: number; down: Vec }
  | { kind: 'fog'; id: number; erase: boolean; radius: number; points: number[] }
  | { kind: 'pencil'; id: number; points: number[] }
  | { kind: 'erase'; id: number }

const TAP = 6
/**
 * At this zoom and below the master's grid is hidden, in the editor and in the game, and shows
 * only around the pointer over the map (QnA, 14.11.2026).
 */
const SPARSE_GRID_PERCENT = 20
/** …in a circle at least this big on screen (radius, px) */
const POINTER_SPOT_PX = 128
/** the master sees the fog half transparent to work under it (QnA: 60%) */
const MASTER_FOG = 0.6
const MIN_STEP = 2

/**
 * The interactive map: Pixi renderer, camera, layers and input. Framework-free: React (or
 * anything else) creates it on a host element, feeds it a view state and reads callbacks.
 * Every change of the map goes through the store as an operation.
 */
export class MapEngine {
  private renderer: Renderer | null = null
  private stage = new Container()
  private below = new Container()
  /**
   * The tiles are drawn into a texture of the view first: the grid reads the color of the map
   * under its lines from it, and the stage shows it as one sprite.
   */
  private belowRoot = new Container()
  private tilesRT: RenderTexture | null = null
  private tilesSprite = new Sprite()
  private above = new Container()
  private overlay = new Graphics()
  private camera = new Camera()
  private theme: MapTheme
  private tiles: TileLayer
  private grid = new GridLayer()
  private build = new BuildLayer()
  private tokens: TokenLayer
  private draws = new DrawLayer()
  private fog: FogLayer
  private view: MapViewState
  private shown: MapScene | null = null
  private dirty = new Set<'build' | 'tokens' | 'draws' | 'vision'>()
  private fit = true
  private destroyed = false
  private frame = 0
  private size = { w: 0, h: 0 }
  private compactTokens = false
  private dpr = Math.min(window.devicePixelRatio || 1, 3)
  private touch = matchMedia('(pointer: coarse)').matches
  private pointers = new Map<number, Vec>()
  private gesture: Gesture | null = null
  private hover: Vec | null = null
  /** the open end of the wall line being drawn: every click adds a segment from it (QnA, 14.11.2026) */
  private wallStart: Pin | null = null
  private space = false
  private selected: string | null = null
  private spawnSelected = false
  /** where the spawn point is being dragged or put */
  private spawnDrag: Vec | null = null
  private hoverDoor: string | null = null
  private erasing: string | null = null
  /** a token dragged in from the interface: where it lands and where the pointer is */
  private ghost: { token: Omit<Token, 'pin'>; at: Vec | null; pointer: Vec | null } | null = null
  private frames: number[] = []
  private stats: MapStats = { frameMs: 0, fps: 0, tiles: 0, tileMB: 0, level: 0, levels: 0, dpr: 1, visionMs: 0 }
  private lastStats = 0
  private lastZoom = ''
  private cleanup: (() => void)[] = []
  private explored: ExploredMask | null = null
  private exploredOff: (() => void) | null = null
  // the engine's own mask is kept up to date by the engine itself
  private ownTracker: ExploredTracker | null = null

  constructor(private host: HTMLElement, private opts: MapEngineOptions) {
    this.view = opts.view
    this.theme = readTheme(host)
    this.tiles = new TileLayer(opts.tiles, () => this.requestRender(), this.touch ? 64 : 192)
    this.tokens = new TokenLayer(() => this.requestRender())
    this.fog = new FogLayer(this.touch ? 1024 : 2048)
    this.above.addChild(this.draws.container, this.build.container, this.tokens.npc, this.fog.sprite, this.tokens.players, this.overlay)
    this.below.addChild(this.tiles.container)
    this.belowRoot.addChild(this.below)
    this.stage.addChild(this.tilesSprite, this.grid.mesh, this.above)
  }

  async init() {
    const rect = this.host.getBoundingClientRect()
    this.size = { w: Math.max(1, rect.width), h: Math.max(1, rect.height) }
    const renderer = await autoDetectRenderer({
      preference: 'webgl',
      width: this.size.w,
      height: this.size.h,
      resolution: this.dpr,
      autoDensity: true,
      antialias: true,
      background: this.theme.canvas.color
    })
    if (this.destroyed) {
      renderer.destroy()
      return
    }
    this.renderer = renderer
    // dynamic: the sprite follows the texture when the view is resized (else it keeps the old size
    // and the map looks stretched in a narrowed window)
    this.tilesRT = RenderTexture.create({ width: this.size.w, height: this.size.h, resolution: this.dpr, dynamic: true })
    this.tilesSprite.texture = this.tilesRT
    this.grid.setTiles(this.tilesRT)
    const scene = this.opts.store.get()
    if (!scene.image) this.camera.scale = this.camera.scaleForPercent(100, cellPx(scene.grid))
    const canvas = renderer.canvas as HTMLCanvasElement
    canvas.style.display = 'block'
    canvas.style.touchAction = 'none'
    this.host.appendChild(canvas)
    await this.build.loadIcons(this.theme)
    if (this.destroyed) return
    this.listen(canvas)
    this.dirty.add('build').add('tokens').add('draws').add('vision')
    this.cleanup.push(this.opts.store.subscribe(() => this.requestRender()))
    this.requestRender()
  }

  // ——— public API ———

  setView(view: MapViewState) {
    const prev = this.view
    this.view = view
    if (prev.role !== view.role || prev.look !== view.look || prev.editor !== view.editor) this.selectToken(null)
    if (prev.role !== view.role || prev.look !== view.look) this.dirty.add('build').add('tokens').add('vision')
    if (JSON.stringify(prev.campaignRules ?? {}) !== JSON.stringify(view.campaignRules ?? {})) {
      this.ownTracker?.update()
      this.dirty.add('vision')
    }
    if (prev.tool !== view.tool) {
      this.wallStart = null
      this.erasing = null
      this.cancelGesture()
      this.dirty.add('build').add('draws')
    }
    this.requestRender()
  }

  get zoom(): ZoomInfo {
    const cell = cellPx(this.opts.store.get().grid)
    const { min, max } = this.camera.limits(this.bounds())
    return { percent: this.camera.percent(cell), min: (min * cell * 100) / CELL_AT_100, max: (max * cell * 100) / CELL_AT_100 }
  }

  zoomTo(percent: number) {
    const cell = cellPx(this.opts.store.get().grid)
    this.camera.zoomAt(this.camera.scaleForPercent(percent, cell), this.size.w / 2, this.size.h / 2, this.bounds())
    this.requestRender()
  }

  /** −/+ buttons: half or double, as in Figma. */
  zoomBy(factor: number) {
    this.camera.zoomAt(this.camera.scale * factor, this.size.w / 2, this.size.h / 2, this.bounds())
    this.requestRender()
  }

  fitMap() {
    this.camera.fit(this.bounds())
    this.requestRender()
  }

  /**
   * Starts dragging a token from the interface (a button or a card): the token follows the
   * pointer over the map and lands on release. A token with the same id moves instead.
   */
  dragToken(token: Omit<Token, 'pin'>, e: PointerEvent) {
    const canvas = this.renderer?.canvas as HTMLCanvasElement | undefined
    if (!canvas) return
    this.ghost = { token, at: null, pointer: null }
    const move = (ev: PointerEvent) => {
      const r = canvas.getBoundingClientRect()
      const inside = ev.clientX >= r.left && ev.clientX <= r.right && ev.clientY >= r.top && ev.clientY <= r.bottom
      const pointer = inside ? this.camera.toWorld(ev.clientX - r.left, ev.clientY - r.top) : null
      this.ghost = { token, at: pointer && this.snapToken(pointer, tokenSize(token)), pointer }
      this.requestRender()
    }
    const end = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', end)
      window.removeEventListener('pointercancel', end)
      const at = ev.type === 'pointerup' ? this.ghost?.at : null
      this.ghost = null
      this.tokens.setGhost(null, null, this.opts.store.get().grid, this.theme)
      const scene = this.opts.store.get()
      const size = tokenSize(token)
      // a token takes its cells: none lands on another
      if (at && !placeTaken(scene, at, size, token.id)) {
        const pin = this.tokenPin(at, size)
        const on = scene.tokens.find((t) => t.id === token.id)
        // a player puts a token only where players see, and moves one only where no wall stands between
        const player = this.view.role === 'player'
        if (on) {
          if (!player || !pathBlocked(tokenCenter(on, scene.grid), at, moveBlockers(scene))) {
            this.opts.store.dispatch({ type: 'token.update', id: token.id, patch: { pin } })
          }
        } else if (!player || playersSee(scene, at, this.explored, this.view.campaignRules)) {
          this.opts.store.dispatch({ type: 'token.add', token: { ...token, pin } })
        }
      }
      this.requestRender()
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', end)
    window.addEventListener('pointercancel', end)
    move(e)
  }

  destroy() {
    this.destroyed = true
    cancelAnimationFrame(this.frame)
    this.exploredOff?.()
    this.ownTracker?.stop()
    for (const fn of this.cleanup) fn()
    this.tiles.destroy()
    this.grid.destroy()
    this.build.destroy()
    this.tokens.destroy()
    this.draws.destroy()
    this.fog.destroy()
    this.overlay.destroy()
    this.tilesSprite.destroy()
    this.belowRoot.destroy({ children: true })
    this.tilesRT?.destroy(true)
    if (this.renderer) {
      ;(this.renderer.canvas as HTMLCanvasElement).remove()
      this.renderer.destroy()
      this.renderer = null
    }
  }

  // ——— rendering ———

  requestRender() {
    if (!this.frame && !this.destroyed) this.frame = requestAnimationFrame(() => this.renderNow())
  }

  private bounds(): CameraBounds {
    const scene = this.opts.store.get()
    return { view: this.size, image: scene.image, cell: cellPx(scene.grid), dpr: this.dpr, touch: this.touch }
  }

  private renderNow() {
    this.frame = 0
    const renderer = this.renderer
    if (!renderer || this.destroyed) return
    const started = performance.now()
    const scene = this.opts.store.get()
    const prev = this.shown
    // the look, not the rights: «Глазами игрока» shows the master the players' map
    const master = (this.view.look ?? this.view.role) === 'master'
    const cell = cellPx(scene.grid)

    if (!prev || prev.image !== scene.image) {
      this.tiles.setImage(scene.image)
      this.fog.setup(renderer, scene.image, cell)
      this.useExplored(scene.image)
      this.fog.syncStrokes(renderer, scene.fog, true)
      this.fit = true
      this.dirty.add('vision')
    } else if (prev.fog !== scene.fog) {
      this.fog.syncStrokes(renderer, scene.fog)
      this.dirty.add('vision')
    }
    const gridChanged = !prev || prev.grid !== scene.grid
    if (gridChanged || prev.walls !== scene.walls || prev.doors !== scene.doors || prev.spawn !== scene.spawn) this.dirty.add('build')
    if (gridChanged || prev.walls !== scene.walls || prev.doors !== scene.doors || prev.tokens !== scene.tokens || prev.rules !== scene.rules) this.dirty.add('vision')
    if (gridChanged || prev.tokens !== scene.tokens) this.dirty.add('tokens')
    if (gridChanged || prev.drawings !== scene.drawings) this.dirty.add('draws')
    this.shown = scene

    if (this.fit && scene.image) {
      this.camera.fit(this.bounds())
      this.fit = false
    }
    this.camera.clamp(this.bounds())

    if (this.dirty.has('build')) this.build.draw(scene, this.theme, { role: this.view.look ?? this.view.role, hoverDoor: this.hoverDoor, erasing: this.erasing })
    // zoomed out, tokens become plain discs: they are drawn anew when the zoom crosses the line
    const compact = this.camera.percent(cell) < TOKEN_COMPACT_PERCENT
    if (compact !== this.compactTokens) {
      this.compactTokens = compact
      this.dirty.add('tokens')
    }
    if (this.dirty.has('tokens')) {
      // players cannot see NPCs under the fog; the server will not even send them later
      this.tokens.sync(scene.tokens, scene.grid, this.theme, this.selected, () => false, compact)
    }
    if (this.dirty.has('draws')) this.draws.draw(scene.drawings, scene.grid, this.theme, this.view.tool === 'draw-erase' ? this.erasing : null)
    if (this.dirty.has('vision')) this.updateVision(renderer, scene)
    this.dirty.clear()

    for (const c of [this.below, this.above]) {
      c.position.set(this.camera.x, this.camera.y)
      c.scale.set(this.camera.scale)
    }
    // players see the grid only around a token they drag, each on their own screen; the master's
    // grid hides when the map is zoomed out to 20% or less and shows around the pointer
    const drag = this.dragSpot()
    const sparse = master && this.camera.percent(cell) <= SPARSE_GRID_PERCENT + 1e-6
    const spot = drag ?? (sparse ? this.hover : null)
    const spotRadius = drag ? cell * SPOT_CELLS : Math.max(cell * SPOT_CELLS, POINTER_SPOT_PX / this.camera.scale)
    this.grid.mesh.visible = scene.grid.enabled && ((master && !sparse) || !!spot)
    this.grid.update(this.camera, this.size.w, this.size.h, this.dpr, { x: scene.grid.offsetX, y: scene.grid.offsetY }, cell, scene.image,
      { everywhere: master && !sparse, spot, spotRadius },
      { light: this.theme.gridLight, dark: this.theme.gridDark, background: this.theme.canvas })
    this.tiles.update(this.camera, this.size.w, this.size.h, this.dpr)
    this.build.updateZoom(this.camera.scale)
    this.build.drawSpawn(this.spawnState(scene, master), cell, this.camera.scale, this.theme)
    this.fog.style(this.rules(scene).darkness ? this.theme.fogDark : this.theme.fog, master ? MASTER_FOG : 1, !!scene.image && this.hasFog(scene))
    this.drawOverlay(scene)
    if (this.ghost) this.tokens.setGhost(this.ghost.token, this.ghost.at, scene.grid, this.theme)

    if (this.tilesRT) renderer.render({ container: this.belowRoot, target: this.tilesRT, clear: true, clearColor: [0, 0, 0, 0] })
    renderer.render(this.stage)

    const now = performance.now()
    this.frames.push(now)
    while (this.frames.length && now - this.frames[0] > 1000) this.frames.shift()
    this.stats = {
      ...this.stats,
      frameMs: now - started,
      fps: this.frames.length,
      tiles: this.tiles.count,
      tileMB: this.tiles.bytes / 1048576,
      level: this.tiles.level,
      levels: scene.image?.levels ?? 0,
      dpr: this.dpr
    }
    if (now - this.lastStats > 250) {
      this.lastStats = now
      this.opts.onStats?.(this.stats)
    }
    const z = this.zoom
    const key = `${z.percent.toFixed(1)}|${z.min.toFixed(1)}|${z.max.toFixed(1)}`
    if (key !== this.lastZoom) {
      this.lastZoom = key
      this.opts.onZoom?.(z)
    }
  }

  /** The map has fog, or the master is drawing the first stroke of it now. */
  private hasFog(scene: MapScene) {
    return scene.fog.length > 0 || this.gesture?.kind === 'fog'
  }

  /** The pointer while a token is dragged (on the map or in from the interface): the grid spotlight. */
  private dragSpot(): Vec | null {
    const g = this.gesture
    if (g?.kind === 'token' && g.moved) return this.hover
    return this.ghost?.pointer ?? null
  }

  /**
   * Line of sight of every player token, cut out of the fog, and what players have seen. Both are
   * kept by the core as the map changes (`playerSight`, `trackExplored`): the engine only shows them.
   */
  private updateVision(renderer: Renderer, scene: MapScene) {
    if (!scene.image || !this.fog.ready || !this.hasFog(scene)) return
    const started = performance.now()
    const polys = playerSight(scene)
    if (this.explored) this.fog.setExplored(this.explored)
    const g = this.gesture
    this.fog.compose(renderer, polys, this.rules(scene).dynamicFog, g?.kind === 'fog' ? { mode: g.erase ? 'erase' : 'paint', radius: g.radius, points: g.points } : null)
    this.stats.visionMs = performance.now() - started
  }

  // the explored mask of the game for its picture, or a mask of the engine's own
  private useExplored(image: MapScene['image']) {
    this.exploredOff?.()
    this.exploredOff = null
    this.ownTracker?.stop()
    this.ownTracker = null
    const given = this.opts.explored
    const fits = !!image && !!given && given.image.width === image.width && given.image.height === image.height
    this.explored = !image ? null : fits ? given! : new ExploredMask(image)
    if (this.explored && !fits) this.ownTracker = trackExplored(this.opts.store, this.explored, () => this.view.campaignRules)
    this.exploredOff = this.explored?.subscribe(() => {
      this.dirty.add('vision')
      this.requestRender()
    }) ?? null
  }

  /** The spawn point as the master sees it: where it stands or is dragged, and the spawn tool's preview. */
  private spawnState(scene: MapScene, master: boolean): SpawnState {
    if (!master) return { at: null, ghost: null, selected: false, erasing: false }
    const at = this.spawnDrag ?? (scene.spawn ? pinToImage(scene.spawn, scene.grid) : null)
    const ghost = this.tool() === 'spawn' && this.hover && !this.gesture ? this.snapToken(this.hover) : null
    return { at, ghost, selected: this.spawnSelected, erasing: this.erasing === 'spawn' }
  }

  private drawOverlay(scene: MapScene) {
    const g = this.overlay
    g.clear()
    const cell = cellPx(scene.grid)
    const px = 1 / this.camera.scale
    const tool = this.tool()
    if ((tool === 'wall' || tool === 'barrier') && this.wallStart && this.hover) {
      const a = pinToImage(this.wallStart, scene.grid)
      const b = pinToImage(this.constrain(this.wallStart, this.snapWall(this.hover)), scene.grid)
      if (dist(a, b) > 0) strokeWalls(g, [[a.x, a.y, b.x, b.y]], tool, cell, this.theme)
    }
    if ((tool === 'wall' || tool === 'barrier') && this.hover) {
      const p = pinToImage(this.wallStart ? this.constrain(this.wallStart, this.snapWall(this.hover)) : this.snapWall(this.hover), scene.grid)
      g.circle(p.x, p.y, 4 * px).fill({ color: this.theme.wall.color, alpha: this.theme.wall.alpha })
    }
    if (tool === 'door') {
      const gesture = this.gesture?.kind === 'door-place' ? this.gesture : null
      const d = gesture ? gesture.span : this.hover && this.doorAt(this.hover)
      if (d) this.build.door(g, pinToImage(d.a, scene.grid), pinToImage(d.b, scene.grid), cell, this.theme, { alpha: gesture ? 1 : 0.6 })
    }
    if ((tool === 'fog-paint' || tool === 'fog-erase') && this.hover) {
      // white on the circle, black just outside it: the brush shows on light and dark maps alike
      const r = this.brushRadius(scene)
      const { cursor, cursorShadow } = this.theme
      g.circle(this.hover.x, this.hover.y, r + px).stroke({ width: px, color: cursorShadow.color, alpha: cursorShadow.alpha })
      g.circle(this.hover.x, this.hover.y, r).stroke({ width: px, color: cursor.color, alpha: cursor.alpha })
    }
  }

  // ——— input ———

  private listen(canvas: HTMLCanvasElement) {
    const on = <K extends keyof HTMLElementEventMap>(el: HTMLElement | Window, type: K, fn: (e: HTMLElementEventMap[K]) => void, opts?: AddEventListenerOptions) => {
      el.addEventListener(type, fn as EventListener, opts)
      this.cleanup.push(() => el.removeEventListener(type, fn as EventListener, opts))
    }
    on(canvas, 'pointerdown', (e) => this.down(e))
    on(canvas, 'pointermove', (e) => this.move(e))
    on(canvas, 'pointerup', (e) => this.up(e))
    on(canvas, 'pointercancel', (e) => this.up(e, true))
    on(canvas, 'pointerleave', () => {
      if (!this.gesture) {
        this.hover = null
        this.requestRender()
      }
    })
    on(canvas, 'wheel', (e) => this.wheel(e), { passive: false })
    on(canvas, 'contextmenu', (e) => e.preventDefault())
    on(window, 'keydown', (e) => this.key(e, true))
    on(window, 'keyup', (e) => this.key(e, false))
    on(canvas, 'webglcontextrestored' as keyof HTMLElementEventMap, () => {
      // render textures lose their content with the context: replay the fog
      const renderer = this.renderer
      if (!renderer) return
      this.fog.syncStrokes(renderer, this.opts.store.get().fog, true)
      this.dirty.add('vision')
      this.requestRender()
    })
    const resize = new ResizeObserver(() => {
      const r = this.host.getBoundingClientRect()
      if (!r.width || !r.height || !this.renderer) return
      this.size = { w: r.width, h: r.height }
      this.dpr = Math.min(window.devicePixelRatio || 1, 3)
      this.renderer.resize(r.width, r.height, this.dpr)
      this.tilesRT?.resize(r.width, r.height, this.dpr)
      this.requestRender()
    })
    resize.observe(this.host)
    this.cleanup.push(() => resize.disconnect())
  }

  private local(e: { clientX: number; clientY: number }): Vec {
    const r = (this.renderer!.canvas as HTMLCanvasElement).getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }

  private tool(): MapTool {
    const t = this.view.tool
    return this.view.role === 'player' && !PLAYER_TOOLS.includes(t) ? 'select' : t
  }

  private down(e: PointerEvent) {
    try {
      ;(this.renderer?.canvas as HTMLCanvasElement).setPointerCapture(e.pointerId)
    } catch {
      // the pointer is already gone (or synthetic): the gesture still works inside the canvas
    }
    const s = this.local(e)
    this.pointers.set(e.pointerId, s)
    if (this.pointers.size === 2) {
      this.cancelGesture()
      const [p, q] = [...this.pointers.values()]
      const mid = { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 }
      this.gesture = { kind: 'pinch', startDist: dist(p, q) || 1, startScale: this.camera.scale, anchor: this.camera.toWorld(mid.x, mid.y) }
      return
    }
    if (this.pointers.size > 2 || this.gesture) return
    const w = this.camera.toWorld(s.x, s.y)
    this.hover = w
    const scene = this.opts.store.get()
    const id = e.pointerId
    // the right button pans with a drag; a right click without moving ends the wall line or drops the tool (see `up`)
    if (e.button === 1 || e.button === 2 || this.space) {
      this.gesture = { kind: 'pan', id, last: s, down: s, button: e.button }
      this.cursor('grabbing')
      return
    }
    switch (this.tool()) {
      case 'select': {
        const t = this.hitToken(w)
        if (t && this.canMove(t)) {
          this.selectToken(t.id)
          this.gesture = { kind: 'token', id, tokenId: t.id, down: s, moved: false, pin: t.pin }
          return
        }
        if (t) {
          this.selectToken(t.id)
          return
        }
        if (this.hitSpawn(w)) {
          this.selectSpawn(true)
          this.gesture = { kind: 'spawn', id, down: s, moved: false }
          return
        }
        const d = this.hitDoor(w)
        if (d && this.canOpen()) {
          this.gesture = { kind: 'door', id, doorId: d.id, down: s }
          return
        }
        this.selectToken(null)
        this.gesture = { kind: 'pan', id, last: s, down: s, button: e.button }
        this.cursor('grabbing')
        return
      }
      case 'wall':
      case 'barrier': {
        // the first click starts the line, every next one adds a segment and the line goes on from it
        const p = this.snapWall(w)
        if (this.wallStart) this.finishWall(p)
        else this.wallStart = p
        this.gesture = { kind: 'wall', id, down: s }
        break
      }
      case 'door': {
        const d = this.doorAt(w)
        if (d) this.gesture = { kind: 'door-place', id, first: d, span: d }
        break
      }
      case 'spawn':
        // the point follows the pointer while the button is down and lands on release
        this.spawnDrag = this.snapToken(w)
        this.gesture = { kind: 'spawn', id, down: s, moved: true }
        break
      case 'build-erase':
        this.eraseBuild(w)
        this.gesture = { kind: 'erase', id }
        break
      case 'fog-paint':
      case 'fog-erase': {
        if (!scene.image) break
        const radius = this.brushRadius(scene)
        const erase = this.tool() === 'fog-erase'
        this.gesture = { kind: 'fog', id, erase, radius, points: [w.x, w.y] }
        this.fog.stroke(this.renderer!, { mode: erase ? 'erase' : 'paint', radius, points: [w.x, w.y] })
        this.dirty.add('vision')
        break
      }
      case 'pencil':
        this.gesture = { kind: 'pencil', id, points: [w.x, w.y] }
        this.draws.drawLive([w.x, w.y], scene.grid, drawingPaint({ color: this.view.drawColor }, this.theme))
        break
      case 'draw-erase':
        this.eraseDrawing(w)
        this.gesture = { kind: 'erase', id }
        break
    }
    this.requestRender()
  }

  private move(e: PointerEvent) {
    const s = this.local(e)
    if (this.pointers.has(e.pointerId)) this.pointers.set(e.pointerId, s)
    const w = this.camera.toWorld(s.x, s.y)
    const g = this.gesture
    const scene = this.opts.store.get()
    if (g?.kind === 'pinch') {
      const [p, q] = [...this.pointers.values()]
      if (!p || !q) return
      const mid = { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 }
      const b = this.bounds()
      const { min, max } = this.camera.limits(b)
      this.camera.scale = Math.min(max, Math.max(min, (g.startScale * dist(p, q)) / g.startDist))
      this.camera.x = mid.x - g.anchor.x * this.camera.scale
      this.camera.y = mid.y - g.anchor.y * this.camera.scale
      this.camera.clamp(b)
      this.requestRender()
      return
    }
    if (g && 'id' in g && g.id !== e.pointerId) return
    this.hover = w
    switch (g?.kind) {
      case 'pan':
        this.camera.panBy(s.x - g.last.x, s.y - g.last.y, this.bounds())
        g.last = s
        break
      case 'token': {
        if (!g.moved && dist(s, g.down) < TAP) break
        g.moved = true
        const t = scene.tokens.find((x) => x.id === g.tokenId)
        if (t) this.tokens.preview(t.id, this.snapToken(w, tokenSize(t)), scene.grid)
        break
      }
      case 'spawn':
        if (!g.moved && dist(s, g.down) < TAP) break
        g.moved = true
        this.spawnDrag = this.snapToken(w)
        break
      case 'door-place':
        g.span = this.doorSpan(g.first, w)
        break
      case 'fog': {
        const n = g.points.length
        if (Math.hypot(w.x - g.points[n - 2], w.y - g.points[n - 1]) * this.camera.scale < MIN_STEP) break
        this.fog.stroke(this.renderer!, { mode: g.erase ? 'erase' : 'paint', radius: g.radius, points: [g.points[n - 2], g.points[n - 1], w.x, w.y] })
        g.points.push(w.x, w.y)
        this.dirty.add('vision')
        break
      }
      case 'pencil': {
        const n = g.points.length
        if (Math.hypot(w.x - g.points[n - 2], w.y - g.points[n - 1]) * this.camera.scale < MIN_STEP) break
        g.points.push(w.x, w.y)
        this.draws.drawLive(g.points, scene.grid, drawingPaint({ color: this.view.drawColor }, this.theme))
        break
      }
      case 'erase':
        if (this.tool() === 'build-erase') this.eraseBuild(w)
        else this.eraseDrawing(w)
        break
      default:
        this.updateHover(w)
    }
    this.requestRender()
  }

  private up(e: PointerEvent, cancel = false) {
    this.pointers.delete(e.pointerId)
    const g = this.gesture
    if (!g) return
    if (g.kind === 'pinch') {
      if (this.pointers.size < 2) this.gesture = null
      return
    }
    if (g.id !== e.pointerId) return
    this.gesture = null
    const scene = this.opts.store.get()
    const s = this.local(e)
    const w = this.camera.toWorld(s.x, s.y)
    if (cancel) {
      this.cancelGesture(g)
      return
    }
    switch (g.kind) {
      case 'pan':
        this.cursor('')
        if (g.button === 2 && dist(s, g.down) < TAP) this.rightClick()
        break
      case 'spawn': {
        const at = this.spawnDrag
        this.spawnDrag = null
        if (!g.moved || !at) break
        const pin = this.tokenPin(at)
        if (!scene.spawn || !samePin(pin, scene.spawn)) this.opts.store.dispatch({ type: 'spawn', pin })
        break
      }
      case 'door-place':
        this.opts.store.dispatch({ type: 'door.add', door: { id: newId(), ...g.span, open: false } })
        break
      case 'token': {
        const t = scene.tokens.find((x) => x.id === g.tokenId)
        if (!t || !g.moved) break
        const size = tokenSize(t)
        const target = this.snapToken(w, size)
        const from = tokenCenter(t, scene.grid)
        // players cannot walk through walls, barriers or closed doors (checked along the straight
        // path); nobody puts a token on another
        if ((this.view.role === 'player' && pathBlocked(from, target, moveBlockers(scene))) || placeTaken(scene, target, size, t.id)) {
          this.tokens.preview(t.id, null, scene.grid, t)
          break
        }
        const pin = this.tokenPin(target, size)
        if (!samePin(pin, t.pin)) this.opts.store.dispatch({ type: 'token.update', id: t.id, patch: { pin } })
        else this.tokens.preview(t.id, null, scene.grid, t)
        break
      }
      case 'door': {
        const d = scene.doors.find((x) => x.id === g.doorId)
        if (d && dist(s, g.down) < TAP) this.opts.store.dispatch({ type: 'door.open', id: d.id, open: !d.open })
        break
      }
      case 'wall':
        if (dist(s, g.down) >= TAP && this.wallStart) this.finishWall(this.snapWall(w))
        break
      case 'fog':
        this.opts.store.dispatch({ type: 'fog.add', stroke: { id: newId(), mode: g.erase ? 'erase' : 'paint', radius: g.radius, points: g.points } })
        break
      case 'pencil':
        this.draws.drawLive(null, scene.grid, this.theme.master)
        this.opts.store.dispatch({
          type: 'draw.add',
          drawing: { id: newId(), author: this.view.role === 'master' ? 'master' : this.view.playerId, color: this.view.drawColor, points: g.points }
        })
        break
    }
    this.requestRender()
  }

  private cancelGesture(g = this.gesture) {
    if (!g) return
    const scene = this.opts.store.get()
    if (g.kind === 'fog') {
      this.fog.syncStrokes(this.renderer!, scene.fog, true)
      this.dirty.add('vision')
    }
    if (g.kind === 'pencil') this.draws.drawLive(null, scene.grid, this.theme.master)
    if (g.kind === 'spawn') this.spawnDrag = null
    if (g.kind === 'pan') this.cursor('')
    if (g.kind === 'token') {
      const t = scene.tokens.find((x) => x.id === g.tokenId)
      if (t) this.tokens.preview(t.id, null, scene.grid, t)
    }
    this.gesture = null
    this.requestRender()
  }

  private wheel(e: WheelEvent) {
    e.preventDefault()
    const s = this.local(e)
    const delta = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY
    const k = Math.exp(-delta * (e.ctrlKey ? 0.01 : 0.0015))
    this.camera.zoomAt(this.camera.scale * k, s.x, s.y, this.bounds())
    this.requestRender()
  }

  private key(e: KeyboardEvent, down: boolean) {
    const t = e.target as HTMLElement | null
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
    if (e.code === 'Space') {
      this.space = down
      if (down && this.hover) e.preventDefault()
      this.cursor(down ? 'grab' : '')
    }
    if (down && e.key === 'Escape') {
      this.wallStart = null
      this.cancelGesture()
      this.requestRender()
    }
  }

  private cursor(c: string) {
    const canvas = this.renderer?.canvas as HTMLCanvasElement | undefined
    if (canvas) canvas.style.cursor = c
  }

  private updateHover(w: Vec) {
    const tool = this.tool()
    let door: string | null = null
    let erasing: string | null = null
    let cursor = ''
    if (tool === 'select') {
      const t = this.hitToken(w)
      const spawn = !t && this.hitSpawn(w)
      const d = !t && !spawn && this.canOpen() ? this.hitDoor(w) : null
      door = d?.id ?? null
      if ((t && this.canMove(t)) || spawn || d) cursor = 'pointer'
    } else if (tool === 'build-erase') {
      erasing = this.hitBuild(w)
    } else if (tool === 'draw-erase') {
      erasing = this.hitDrawing(w)?.id ?? null
    } else if (tool === 'fog-paint' || tool === 'fog-erase') {
      cursor = 'none'
    } else cursor = 'crosshair'
    if (this.space) cursor = 'grab'
    this.cursor(cursor)
    if (door !== this.hoverDoor || erasing !== this.erasing) {
      this.hoverDoor = door
      this.erasing = erasing
      this.dirty.add('build').add('draws')
    }
  }

  // ——— snapping and hit tests ———

  private cell() {
    return cellPx(this.opts.store.get().grid)
  }

  private brushRadius(scene: MapScene) {
    return (this.view.brush * cellPx(scene.grid)) / 4
  }

  /** Where a token (the spawn point: size 1) lands: on whole cells with the grid, at the pointer without it. */
  private snapToken(w: Vec, size = 1): Vec {
    return snapTokenCenter(w, size, this.opts.store.get().grid)
  }

  private tokenPin(center: Vec, size = 1): Pin {
    return tokenPinAt(center, size, this.opts.store.get().grid)
  }

  /** A wall end: a grid node, or free with snapping to the ends of existing walls. */
  private snapWall(w: Vec): Pin {
    const scene = this.opts.store.get()
    if (scene.grid.enabled) return nodePin(w, scene.grid)
    const near = 10 / this.camera.scale
    for (const wall of scene.walls) {
      for (const p of [wall.a, wall.b]) if (dist(pinToImage(p, scene.grid), w) < near) return p
    }
    return imagePin(w)
  }

  /** On the grid walls run along cell edges: only straight lines. */
  private constrain(start: Pin, end: Pin): Pin {
    if (start.space !== 'grid' || end.space !== 'grid') return end
    return Math.abs(end.u - start.u) >= Math.abs(end.v - start.v) ? { ...end, v: start.v } : { ...end, u: start.u }
  }

  /** Adds the segment from the open end of the line to `p`; the line goes on from its end. */
  private finishWall(p: Pin) {
    const start = this.wallStart
    if (!start) return
    const end = this.constrain(start, p)
    const grid = this.opts.store.get().grid
    // a second click on the same point (a double click) adds nothing
    if (samePin(start, end) || dist(pinToImage(start, grid), pinToImage(end, grid)) * this.camera.scale < MIN_STEP) return
    const kind = this.tool() === 'barrier' ? 'barrier' : 'wall'
    this.opts.store.dispatch({ type: 'wall.add', wall: { id: newId(), kind, a: start, b: end } })
    this.wallStart = end
  }

  /** A right click: ends the wall line if one is drawn, otherwise drops the tool. */
  private rightClick() {
    if (this.wallStart) {
      this.wallStart = null
      this.requestRender()
    } else if (this.view.tool !== 'select') this.opts.onToolEnd?.()
  }

  /**
   * The door of the door tool stretched from its first cell edge towards the pointer, along the
   * same wall: whole cells with the grid, freely without it. It stops at the wall's ends and at
   * other doors.
   */
  private doorSpan(first: NewDoor, w: Vec): NewDoor {
    const scene = this.opts.store.get()
    const wall = scene.walls.find((x) => x.id === first.wallId)
    if (!wall) return first
    const at = (p: Pin) => pinToImage(p, scene.grid)
    const A = at(wall.a)
    const B = at(wall.b)
    if (dist(A, B) < 1) return first
    const along = (p: Pin) => projectT(at(p), A, B)
    const [lo0, hi0] = [along(first.a), along(first.b)].sort((x, y) => x - y)
    const step = hi0 - lo0
    if (step <= 0) return first
    let min = 0
    let max = 1
    for (const d of scene.doors) {
      if (d.wallId !== wall.id) continue
      const [p1, p2] = [along(d.a), along(d.b)].sort((x, y) => x - y)
      if (p2 <= lo0 + 1e-6) min = Math.max(min, p2)
      else if (p1 >= hi0 - 1e-6) max = Math.min(max, p1)
    }
    const t = projectT(w, A, B)
    let lo = lo0
    let hi = hi0
    const grid = scene.grid.enabled && first.a.space === 'grid'
    if (grid) {
      if (t > hi0) hi = hi0 + Math.min(Math.ceil((t - hi0) / step), Math.floor((max - hi0) / step + 1e-6)) * step
      if (t < lo0) lo = lo0 - Math.min(Math.ceil((lo0 - t) / step), Math.floor((lo0 - min) / step + 1e-6)) * step
    } else {
      hi = Math.min(max, Math.max(hi0, t + step / 2))
      lo = Math.max(min, Math.min(lo0, t - step / 2))
    }
    const point = (u: number) => ({ x: A.x + (B.x - A.x) * u, y: A.y + (B.y - A.y) * u })
    const pin = (u: number): Pin => (grid ? nodePin(point(u), scene.grid) : imagePin(point(u)))
    return { wallId: wall.id, a: pin(lo), b: pin(hi) }
  }

  /** The door that would be placed here: one cell edge lying on a wall or barrier. */
  private doorAt(w: Vec): NewDoor | null {
    const scene = this.opts.store.get()
    const { grid } = scene
    const c = cellPx(grid)
    const at = (p: Pin) => pinToImage(p, grid)
    const free = (wallId: string, a: Vec, b: Vec) =>
      !scene.doors.some((d) => {
        if (d.wallId !== wallId) return false
        const da = at(d.a), db = at(d.b)
        const A = at(scene.walls.find((x) => x.id === wallId)!.a), B = at(scene.walls.find((x) => x.id === wallId)!.b)
        const [p1, p2] = [projectT(da, A, B), projectT(db, A, B)].sort((x, y) => x - y)
        const [q1, q2] = [projectT(a, A, B), projectT(b, A, B)].sort((x, y) => x - y)
        return q1 < p2 - 1e-6 && q2 > p1 + 1e-6
      })
    if (grid.enabled) {
      const g = imageToGrid(w, grid)
      const hv = Math.round(g.v), hu = Math.floor(g.u)
      const vu = Math.round(g.u), vv = Math.floor(g.v)
      const horizontal = Math.abs(g.v - hv) <= Math.abs(g.u - vu)
      if (Math.min(Math.abs(g.v - hv), Math.abs(g.u - vu)) > 0.35) return null
      const a: Pin = horizontal ? { space: 'grid', u: hu, v: hv } : { space: 'grid', u: vu, v: vv }
      const b: Pin = horizontal ? { space: 'grid', u: hu + 1, v: hv } : { space: 'grid', u: vu, v: vv + 1 }
      const ea = at(a), eb = at(b)
      const wall = scene.walls.find((x) => distToSegment(ea, at(x.a), at(x.b)) < 0.5 && distToSegment(eb, at(x.a), at(x.b)) < 0.5)
      return wall && free(wall.id, ea, eb) ? { wallId: wall.id, a, b } : null
    }
    let best: { id: string; d: number } | null = null
    for (const x of scene.walls) {
      const d = distToSegment(w, at(x.a), at(x.b))
      if (d < c / 2 && (!best || d < best.d)) best = { id: x.id, d }
    }
    if (!best) return null
    const wall = scene.walls.find((x) => x.id === best!.id)!
    const A = at(wall.a), B = at(wall.b)
    const len = dist(A, B)
    if (len < 1) return null
    const half = Math.min(c / 2, len / 2) / len
    const t = Math.min(1 - half, Math.max(half, projectT(w, A, B)))
    const a = { x: A.x + (B.x - A.x) * (t - half), y: A.y + (B.y - A.y) * (t - half) }
    const b = { x: A.x + (B.x - A.x) * (t + half), y: A.y + (B.y - A.y) * (t + half) }
    return free(wall.id, a, b) ? { wallId: wall.id, a: imagePin(a), b: imagePin(b) } : null
  }

  private hitToken(w: Vec): Token | null {
    const scene = this.opts.store.get()
    const c = cellPx(scene.grid)
    const list = [...scene.tokens].sort((a, b) => (a.kind === b.kind ? 0 : a.kind === 'player' ? -1 : 1))
    for (const t of list) {
      if (this.view.role === 'player' && t.kind === 'npc') continue
      if (dist(tokenCenter(t, scene.grid), w) <= (tokenSize(t) * c) / 2) return t
    }
    return null
  }

  private hitDoor(w: Vec): Door | null {
    const scene = this.opts.store.get()
    const tol = cellPx(scene.grid) / 6
    const player = this.view.role === 'player'
    for (const d of scene.doors) {
      if (player && d.open) continue
      if (distToSegment(w, pinToImage(d.a, scene.grid), pinToImage(d.b, scene.grid)) > tol) continue
      // a player opens only a door players see: one under the fog is not even found
      if (player && !doorSeen(scene, d, this.explored, this.view.campaignRules)) continue
      return d
    }
    return null
  }

  private hitBuild(w: Vec): string | null {
    const scene = this.opts.store.get()
    const c = this.cell()
    const d = this.hitDoor(w)
    if (d) return d.id
    if (scene.spawn && dist(pinToImage(scene.spawn, scene.grid), w) <= spawnRadius(c, this.camera.scale)) return 'spawn'
    const tol = Math.max(c / 8, 6 / this.camera.scale)
    for (const x of scene.walls) if (distToSegment(w, pinToImage(x.a, scene.grid), pinToImage(x.b, scene.grid)) <= tol) return x.id
    return null
  }

  private hitDrawing(w: Vec) {
    const scene = this.opts.store.get()
    const tol = (this.cell() * PENCIL) / 2 + 6 / this.camera.scale
    for (let i = scene.drawings.length - 1; i >= 0; i--) {
      const d = scene.drawings[i]
      if (this.view.role === 'player' && d.author === 'master') continue
      if (distToPolyline(w, d.points) <= tol) return d
    }
    return null
  }

  private eraseBuild(w: Vec) {
    const hit = this.hitBuild(w)
    if (!hit) return
    if (hit === 'spawn') this.opts.store.dispatch({ type: 'spawn', pin: null })
    else this.opts.store.dispatch({ type: 'build.remove', ids: [hit] })
    this.erasing = null
  }

  private eraseDrawing(w: Vec) {
    const d = this.hitDrawing(w)
    if (d) this.opts.store.dispatch({ type: 'draw.remove', ids: [d.id] })
    this.erasing = null
  }

  private canMove(t: Token) {
    if (this.view.role === 'master') return true
    return t.kind === 'player' && (t.owner ?? t.id) === this.view.playerId && this.rules().freeMove
  }

  private canOpen() {
    return this.view.role === 'master' || this.rules().freeDoors
  }

  /** the conditions that work now: the campaign, then what this map changed */
  private rules(scene = this.opts.store.get()): MapRules {
    return rulesOf(scene, this.view.campaignRules)
  }

  /** The spawn point under the pointer, when it can be selected and dragged: the master's, in the editor. */
  private hitSpawn(w: Vec): boolean {
    const scene = this.opts.store.get()
    if (!scene.spawn || !this.view.editor || this.view.role !== 'master' || (this.view.look ?? 'master') !== 'master') return false
    return dist(pinToImage(scene.spawn, scene.grid), w) <= spawnRadius(this.cell(), this.camera.scale)
  }

  /** Selecting a token drops the spawn point's selection, and the other way round. */
  private selectToken(id: string | null) {
    this.selectSpawn(false)
    if (id === this.selected) return
    this.selected = id
    this.dirty.add('tokens')
    this.opts.onSelect?.(id)
  }

  private selectSpawn(on: boolean) {
    if (on) this.selectToken(null)
    if (this.spawnSelected === on) return
    this.spawnSelected = on
    this.requestRender()
  }
}
