import { autoDetectRenderer, Container, Graphics, type Renderer } from 'pixi.js'
import {
  cellPin, cellPx, dist, distToPolyline, distToSegment, imagePin, imageToGrid, newId, nodePin, pinToImage, projectT, samePin
} from '../core/geometry'
import type { MapStore } from '../core/store'
import { rulesOf } from '../core/scene'
import type { Door, FlowColor, MapRules, MapScene, Pin, RuleOverrides, Token, TileProvider, Vec } from '../core/types'
import { moveBlockers, pathBlocked, sightBlockers, visibilityPolygon, visionRadius } from '../core/visibility'
import { BuildLayer, strokeWalls } from './BuildLayer'
import { Camera, CELL_AT_100, type CameraBounds } from './camera'
import { DrawLayer, drawingPaint, PENCIL } from './DrawLayer'
import { FogLayer } from './FogLayer'
import { GridLayer } from './GridLayer'
import { readTheme, type MapTheme } from './theme'
import { TileLayer } from './TileLayer'
import { TokenLayer } from './TokenLayer'

export type MapRole = 'master' | 'player'

/** select: move tokens, open doors, pan. The rest are the tools of the editor and the game. */
export type MapTool = 'select' | 'wall' | 'barrier' | 'door' | 'spawn' | 'build-erase' | 'fog-paint' | 'fog-erase' | 'pencil' | 'draw-erase'

const PLAYER_TOOLS: MapTool[] = ['select', 'pencil', 'draw-erase']

export interface MapViewState {
  role: MapRole
  /** who draws and whose token is "own" */
  playerId: string
  drawColor: FlowColor | 'master'
  tool: MapTool
  /** fog brush 1–20: diameter in half cells */
  brush: number
  /** settings of the campaign: the map follows them where it did not change them itself */
  campaignRules?: RuleOverrides
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
}

type Gesture =
  | { kind: 'pan'; id: number; last: Vec }
  | { kind: 'pinch'; startDist: number; startScale: number; anchor: Vec }
  | { kind: 'token'; id: number; tokenId: string; down: Vec; moved: boolean; pin: Pin }
  | { kind: 'door'; id: number; doorId: string; down: Vec }
  | { kind: 'wall'; id: number; down: Vec }
  | { kind: 'fog'; id: number; erase: boolean; radius: number; points: number[] }
  | { kind: 'pencil'; id: number; points: number[] }
  | { kind: 'erase'; id: number }

const TAP = 6
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
  private dpr = Math.min(window.devicePixelRatio || 1, 3)
  private touch = matchMedia('(pointer: coarse)').matches
  private pointers = new Map<number, Vec>()
  private gesture: Gesture | null = null
  private hover: Vec | null = null
  private wallStart: Pin | null = null
  private space = false
  private selected: string | null = null
  private hoverDoor: string | null = null
  private erasing: string | null = null
  /** a token dragged in from the interface: where it lands and where the pointer is */
  private ghost: { token: Omit<Token, 'pin'>; at: Vec | null; pointer: Vec | null } | null = null
  private frames: number[] = []
  private stats: MapStats = { frameMs: 0, fps: 0, tiles: 0, tileMB: 0, level: 0, levels: 0, dpr: 1, visionMs: 0 }
  private lastStats = 0
  private lastZoom = ''
  private cleanup: (() => void)[] = []

  constructor(private host: HTMLElement, private opts: MapEngineOptions) {
    this.view = opts.view
    this.theme = readTheme(host)
    this.tiles = new TileLayer(opts.tiles, () => this.requestRender(), this.touch ? 64 : 192)
    this.tokens = new TokenLayer(() => this.requestRender())
    this.fog = new FogLayer(this.touch ? 1024 : 2048)
    this.above.addChild(this.draws.container, this.build.container, this.tokens.npc, this.fog.sprite, this.tokens.players, this.overlay)
    this.below.addChild(this.tiles.container)
    this.stage.addChild(this.below, this.grid.mesh, this.above)
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
    if (prev.role !== view.role) {
      this.dirty.add('build').add('tokens').add('vision')
      this.selectToken(null)
    }
    if (JSON.stringify(prev.campaignRules ?? {}) !== JSON.stringify(view.campaignRules ?? {})) this.dirty.add('vision')
    if (prev.tool !== view.tool) {
      this.wallStart = null
      this.erasing = null
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
      this.ghost = { token, at: pointer && this.snapToken(pointer), pointer }
      this.requestRender()
    }
    const end = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', end)
      window.removeEventListener('pointercancel', end)
      const at = ev.type === 'pointerup' ? this.ghost?.at : null
      this.ghost = null
      this.tokens.setGhost(null, null, this.opts.store.get().grid, this.theme)
      if (at) {
        const scene = this.opts.store.get()
        const pin = this.tokenPin(at)
        if (scene.tokens.some((t) => t.id === token.id)) this.opts.store.dispatch({ type: 'token.update', id: token.id, patch: { pin } })
        else this.opts.store.dispatch({ type: 'token.add', token: { ...token, pin } })
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
    for (const fn of this.cleanup) fn()
    this.tiles.destroy()
    this.grid.destroy()
    this.build.destroy()
    this.tokens.destroy()
    this.draws.destroy()
    this.fog.destroy()
    this.overlay.destroy()
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
    const master = this.view.role === 'master'
    const cell = cellPx(scene.grid)

    if (!prev || prev.image !== scene.image) {
      this.tiles.setImage(scene.image)
      this.fog.setup(renderer, scene.image, cell)
      this.fog.syncStrokes(renderer, scene.fog, true)
      this.fit = true
      this.dirty.add('vision')
    } else if (prev.fog !== scene.fog) {
      this.fog.syncStrokes(renderer, scene.fog)
      if (!scene.fog.length) this.fog.resetExplored(renderer)
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

    if (this.dirty.has('build')) this.build.draw(scene, this.theme, { role: this.view.role, hoverDoor: this.hoverDoor, erasing: this.erasing })
    if (this.dirty.has('tokens')) {
      // players cannot see NPCs under the fog; the server will not even send them later
      this.tokens.sync(scene.tokens, scene.grid, this.theme, this.selected, () => false)
    }
    if (this.dirty.has('draws')) this.draws.draw(scene.drawings, scene.grid, this.theme, this.view.tool === 'draw-erase' ? this.erasing : null)
    if (this.dirty.has('vision')) this.updateVision(renderer, scene)
    this.dirty.clear()

    for (const c of [this.below, this.above]) {
      c.position.set(this.camera.x, this.camera.y)
      c.scale.set(this.camera.scale)
    }
    // players see the grid only around a token they drag, each on their own screen
    const spot = this.dragSpot()
    this.grid.mesh.visible = scene.grid.enabled && (master || !!spot)
    this.grid.update(this.camera, this.size.w, this.size.h, this.dpr, { x: scene.grid.offsetX, y: scene.grid.offsetY }, cell, scene.image, master, spot, {
      paint: this.theme.grid, contrast: this.theme.gridContrast
    })
    this.tiles.update(this.camera, this.size.w, this.size.h, this.dpr)
    this.build.updateZoom(this.camera.scale)
    this.fog.style(this.rules(scene).darkness ? this.theme.fogDark : this.theme.fog, master ? MASTER_FOG : 1, !!scene.image && scene.fog.length > 0)
    this.drawOverlay(scene)
    if (this.ghost) this.tokens.setGhost(this.ghost.token, this.ghost.at, scene.grid, this.theme)

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

  /** The pointer while a token is dragged (on the map or in from the interface): the grid spotlight. */
  private dragSpot(): Vec | null {
    const g = this.gesture
    if (g?.kind === 'token' && g.moved) return this.hover
    return this.ghost?.pointer ?? null
  }

  /** Line of sight of every player token, cut out of the fog. The server will do this later. */
  private updateVision(renderer: Renderer, scene: MapScene) {
    if (!scene.image || !this.fog.ready || !scene.fog.length) return
    const started = performance.now()
    const blockers = sightBlockers(scene)
    const bounds = { x: 0, y: 0, w: scene.image.width, h: scene.image.height }
    const polys: number[][] = []
    for (const t of scene.tokens) {
      if (t.kind !== 'player') continue
      const p = pinToImage(t.pin, scene.grid)
      const poly = visibilityPolygon(p.x, p.y, blockers, visionRadius(t, scene), bounds)
      if (poly.length >= 6) polys.push(poly)
    }
    this.fog.compose(renderer, polys, this.rules(scene).dynamicFog)
    this.stats.visionMs = performance.now() - started
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
      strokeWalls(g, [[a.x, a.y, b.x, b.y]], tool, cell, this.theme)
    }
    if ((tool === 'wall' || tool === 'barrier') && this.hover) {
      const p = pinToImage(this.wallStart ? this.constrain(this.wallStart, this.snapWall(this.hover)) : this.snapWall(this.hover), scene.grid)
      g.circle(p.x, p.y, 4 * px).fill({ color: this.theme.wall.color, alpha: this.theme.wall.alpha })
    }
    if (tool === 'door' && this.hover) {
      const d = this.doorAt(this.hover)
      if (d) {
        const a = pinToImage(d.a, scene.grid)
        const b = pinToImage(d.b, scene.grid)
        g.moveTo(a.x, a.y).lineTo(b.x, b.y).stroke({ width: cell / 8, color: this.theme.doorOutline.color, alpha: 0.6 })
      }
    }
    if ((tool === 'fog-paint' || tool === 'fog-erase') && this.hover) {
      g.circle(this.hover.x, this.hover.y, this.brushRadius(scene)).stroke({ width: px, color: this.theme.cursor.color, alpha: this.theme.cursor.alpha })
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
    if (e.button === 1 || e.button === 2 || this.space) {
      if (e.button === 2 && this.wallStart) this.wallStart = null
      this.gesture = { kind: 'pan', id, last: s }
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
        const d = this.hitDoor(w)
        if (d && this.canOpen()) {
          this.gesture = { kind: 'door', id, doorId: d.id, down: s }
          return
        }
        this.selectToken(null)
        this.gesture = { kind: 'pan', id, last: s }
        this.cursor('grabbing')
        return
      }
      case 'wall':
      case 'barrier': {
        const p = this.snapWall(w)
        if (!this.wallStart) {
          this.wallStart = p
          this.gesture = { kind: 'wall', id, down: s }
        } else this.finishWall(p)
        break
      }
      case 'door': {
        const d = this.doorAt(w)
        if (d) this.opts.store.dispatch({ type: 'door.add', door: { id: newId(), ...d, open: false } })
        break
      }
      case 'spawn':
        this.opts.store.dispatch({ type: 'spawn', pin: this.tokenPin(w) })
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
        if (t) this.tokens.preview(t.id, this.snapToken(w), scene.grid)
        break
      }
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
        break
      case 'token': {
        const t = scene.tokens.find((x) => x.id === g.tokenId)
        if (!t || !g.moved) break
        const target = this.snapToken(w)
        const from = pinToImage(t.pin, scene.grid)
        // players cannot walk through walls, barriers or closed doors (checked along the straight path)
        if (this.view.role === 'player' && pathBlocked(from, target, moveBlockers(scene))) {
          this.tokens.preview(t.id, null, scene.grid, t)
          break
        }
        const pin = this.tokenPin(target)
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
      const d = !t && this.canOpen() ? this.hitDoor(w) : null
      door = d?.id ?? null
      if ((t && this.canMove(t)) || d) cursor = 'pointer'
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

  /** Where a token lands: the cell center with the grid, the pointer without it. */
  private snapToken(w: Vec): Vec {
    const grid = this.opts.store.get().grid
    return grid.enabled ? pinToImage(cellPin(w, grid), grid) : w
  }

  private tokenPin(w: Vec): Pin {
    const grid = this.opts.store.get().grid
    return grid.enabled ? cellPin(w, grid) : imagePin(w)
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

  private finishWall(p: Pin) {
    const start = this.wallStart
    this.wallStart = null
    if (!start) return
    const end = this.constrain(start, p)
    if (samePin(start, end)) return
    const kind = this.tool() === 'barrier' ? 'barrier' : 'wall'
    this.opts.store.dispatch({ type: 'wall.add', wall: { id: newId(), kind, a: start, b: end } })
  }

  /** The door that would be placed here: one cell edge lying on a wall or barrier. */
  private doorAt(w: Vec): Omit<Door, 'id' | 'open'> | null {
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
    const r = cellPx(scene.grid) / 2
    const list = [...scene.tokens].sort((a, b) => (a.kind === b.kind ? 0 : a.kind === 'player' ? -1 : 1))
    for (const t of list) {
      if (this.view.role === 'player' && t.kind === 'npc') continue
      if (dist(pinToImage(t.pin, scene.grid), w) <= r) return t
    }
    return null
  }

  private hitDoor(w: Vec): Door | null {
    const scene = this.opts.store.get()
    const tol = cellPx(scene.grid) / 6
    for (const d of scene.doors) {
      if (d.open && this.view.role === 'player') continue
      if (distToSegment(w, pinToImage(d.a, scene.grid), pinToImage(d.b, scene.grid)) <= tol) return d
    }
    return null
  }

  private hitBuild(w: Vec): string | null {
    const scene = this.opts.store.get()
    const c = this.cell()
    const d = this.hitDoor(w)
    if (d) return d.id
    if (scene.spawn && dist(pinToImage(scene.spawn, scene.grid), w) <= c * 0.35) return 'spawn'
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
    return t.kind === 'player' && t.id === this.view.playerId && this.rules().freeMove
  }

  private canOpen() {
    return this.view.role === 'master' || this.rules().freeDoors
  }

  /** the conditions that work now: the campaign, then what this map changed */
  private rules(scene = this.opts.store.get()): MapRules {
    return rulesOf(scene, this.view.campaignRules)
  }

  private selectToken(id: string | null) {
    if (id === this.selected) return
    this.selected = id
    this.dirty.add('tokens')
    this.opts.onSelect?.(id)
  }
}
