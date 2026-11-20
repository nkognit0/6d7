import { Container, Graphics, Sprite, type Texture } from 'pixi.js'
import doorSvg from '../../ui/icons/svg/icon.16/door.svg?raw'
import homeSvg from '../../ui/icons/svg/icon.16/home.svg?raw'
import { cellPx, pinToImage } from '../core/geometry'
import type { MapScene, Vec, WallKind } from '../core/types'
import { withoutDoors, type Segment } from '../core/visibility'
import { CELL_AT_100 } from './camera'
import type { MapTheme } from './theme'
import { svgTexture } from './textures'

// Sizes are parts of a cell, so lines scale with the map. At 100% (128 px cell): wall 8 px,
// outline 1 px, door plate 16 px.
const WALL = 1 / 16
const OUTLINE = 1 / 128
const DOOR = 1 / 8
const DASH = 1 / 8
const GAP = 1 / 16
/** points on each round end of a wall */
const CAP_STEPS = 8
/** below this size on screen the door icon is hidden */
const MIN_ICON_PX = 10
/** an object under the eraser fades: the walls are red already, a red highlight would not show */
export const ERASING_ALPHA = 0.35
/** the spawn point: radius in cells */
const SPAWN = 0.3
/** below this zoom the spawn point is solid bright blue, so it shows on any map */
export const SPAWN_SOLID_PERCENT = 40
/** the spawn point never gets smaller than this radius on screen */
const MIN_SPAWN_PX = 8
/** the selection ring of the spawn point: width in cells, never thinner than 2 px on screen */
const SPAWN_SELECT = 1 / 32
/** the spawn tool's preview under the pointer, like a token dragged in from the panel */
const GHOST_ALPHA = 0.7

/** Radius of the spawn point in pixels of the picture at this zoom. */
export const spawnRadius = (cell: number, scale: number) => Math.max(cell * SPAWN, MIN_SPAWN_PX / scale)

/**
 * The segment widened by `half` on each side: a rectangle, or with round ends (a stadium). Walls
 * are filled polygons, not Pixi strokes: the stroke builder of Pixi drew stray thin wedges
 * between walls (user report of 14.11.2026), and its round caps cost hundreds of vertices per dash.
 */
function band([x1, y1, x2, y2]: Segment, half: number, round: boolean): number[] {
  const len = Math.hypot(x2 - x1, y2 - y1)
  const dx = len ? (x2 - x1) / len : 1
  const dy = len ? (y2 - y1) / len : 0
  const nx = -dy * half
  const ny = dx * half
  if (!round) return [x1 + nx, y1 + ny, x2 + nx, y2 + ny, x2 - nx, y2 - ny, x1 - nx, y1 - ny]
  const pts: number[] = []
  const a0 = Math.atan2(ny, nx)
  // around b from +n through the direction of the wall to −n, then around a back to +n
  for (let i = 0; i <= CAP_STEPS; i++) {
    const a = a0 - (Math.PI * i) / CAP_STEPS
    pts.push(x2 + Math.cos(a) * half, y2 + Math.sin(a) * half)
  }
  for (let i = 0; i <= CAP_STEPS; i++) {
    const a = a0 + Math.PI - (Math.PI * i) / CAP_STEPS
    pts.push(x1 + Math.cos(a) * half, y1 + Math.sin(a) * half)
  }
  return pts
}

function dashes(segs: Segment[], dash: number, gap: number): Segment[] {
  const out: Segment[] = []
  for (const [x1, y1, x2, y2] of segs) {
    const len = Math.hypot(x2 - x1, y2 - y1)
    if (!len) continue
    const dx = (x2 - x1) / len
    const dy = (y2 - y1) / len
    for (let s = 0; s < len; s += dash + gap) {
      const e = Math.min(len, s + dash)
      out.push([x1 + dx * s, y1 + dy * s, x1 + dx * e, y1 + dy * e])
    }
  }
  return out
}

/**
 * Walls or barriers in their map style; also used for the preview while a wall is drawn. A wall
 * is a red band with round ends on a thin dark outline; a barrier — a dark band with blue dashes.
 */
export function strokeWalls(g: Graphics, segs: Segment[], kind: WallKind, cell: number, theme: MapTheme, alpha = 1) {
  const half = (cell * WALL) / 2
  const outline = theme.wallOutline
  const color = kind === 'wall' ? theme.wall : theme.barrier
  // outlines first: a wall cut by a door must not cover the other half with its outline
  for (const s of segs) g.poly(band(s, half + cell * OUTLINE, true)).fill({ color: outline.color, alpha: outline.alpha * alpha })
  const tops = kind === 'wall' ? segs : dashes(segs, cell * DASH, cell * GAP)
  for (const s of tops) g.poly(band(s, half, kind === 'wall')).fill({ color: color.color, alpha: color.alpha * alpha })
}

// corners of the door plate on the edge a–b, a little shorter than the edge
export function doorPlate(a: Vec, b: Vec, cell: number): number[] {
  const len = Math.hypot(b.x - a.x, b.y - a.y) || 1
  const dx = (b.x - a.x) / len
  const dy = (b.y - a.y) / len
  const inset = Math.min(cell * GAP, len / 4)
  const h = (cell * DOOR) / 2
  const x1 = a.x + dx * inset, y1 = a.y + dy * inset
  const x2 = b.x - dx * inset, y2 = b.y - dy * inset
  return [x1 - dy * h, y1 + dx * h, x2 - dy * h, y2 + dx * h, x2 + dy * h, y2 - dx * h, x1 + dy * h, y1 - dx * h]
}

export interface BuildState {
  role: 'master' | 'player'
  /** door under the pointer that can be opened */
  hoverDoor: string | null
  /** object under the eraser: a wall or door id, or 'spawn' */
  erasing: string | null
}

export interface SpawnState {
  /** where the spawn point stands (or is dragged to); null — no spawn point */
  at: Vec | null
  /** the spawn tool's preview under the pointer */
  ghost: Vec | null
  selected: boolean
  erasing: boolean
}

/**
 * Walls, barriers, doors and the spawn point. Players see walls and doors (barriers and the
 * spawn point are the master's).
 */
export class BuildLayer {
  readonly container = new Container()
  private g = new Graphics()
  private icons = new Container()
  private spawn = new Container()
  private spawnG = new Graphics()
  private spawnIcons: Sprite[] = []
  private spawnKey = ''
  private doorIcon: Texture | null = null
  private spawnIcon: Texture | null = null
  private iconSize = 0

  constructor() {
    this.spawn.addChild(this.spawnG)
    this.container.addChild(this.g, this.icons, this.spawn)
  }

  async loadIcons(theme: MapTheme) {
    ;[this.doorIcon, this.spawnIcon] = await Promise.all([svgTexture(doorSvg, theme.doorIcon, 64), svgTexture(homeSvg, theme.spawnIcon, 64)])
  }

  draw(scene: MapScene, theme: MapTheme, state: BuildState) {
    const g = this.g
    g.clear()
    for (const s of this.icons.removeChildren()) s.destroy()
    const c = cellPx(scene.grid)
    const master = state.role === 'master'
    const at = (p: Parameters<typeof pinToImage>[0]) => pinToImage(p, scene.grid)
    const fade = (id: string) => (state.erasing === id ? ERASING_ALPHA : 1)

    for (const kind of ['barrier', 'wall'] as const) {
      if (kind === 'barrier' && !master) continue
      for (const w of scene.walls) {
        if (w.kind !== kind) continue
        const open = scene.doors.filter((d) => d.wallId === w.id && d.open)
        strokeWalls(g, withoutDoors(at(w.a), at(w.b), open, scene), kind, c, theme, fade(w.id))
      }
    }

    const iconSize = c * DOOR
    for (const d of scene.doors) {
      if (d.open && !master) continue
      this.door(g, at(d.a), at(d.b), c, theme, { open: d.open, hover: state.hoverDoor === d.id, alpha: fade(d.id) })
    }
    this.iconSize = iconSize
  }

  /** A door plate with its icon: the doors of the map and the preview of the door tool. */
  door(g: Graphics, a: Vec, b: Vec, c: number, theme: MapTheme, o: { open?: boolean; hover?: boolean; alpha?: number }) {
    const k = (o.alpha ?? 1) * (o.open ? 0.6 : 1)
    const corners = doorPlate(a, b, c)
    const outline = theme.doorOutline
    if (o.open) g.poly(corners).stroke({ width: c * OUTLINE * 2, color: outline.color, alpha: outline.alpha * k })
    else {
      const fill = o.hover ? theme.doorHover : theme.doorFill
      g.poly(corners).fill({ color: fill.color, alpha: fill.alpha * k }).stroke({ width: c * OUTLINE * 2, color: outline.color, alpha: outline.alpha * k })
    }
    if (this.doorIcon && g === this.g) {
      const icon = new Sprite(this.doorIcon)
      icon.anchor.set(0.5)
      icon.position.set((a.x + b.x) / 2, (a.y + b.y) / 2)
      icon.width = icon.height = c * DOOR
      icon.alpha = k
      this.icons.addChild(icon)
    }
  }

  /**
   * The spawn point (the master's) and the spawn tool's preview. Redrawn only when something of
   * it changed, the zoom included: below 40% it is solid bright blue and keeps a size on screen.
   */
  drawSpawn(spawn: SpawnState, c: number, scale: number, theme: MapTheme) {
    const key = JSON.stringify([spawn, c, scale])
    if (key === this.spawnKey) return
    this.spawnKey = key
    const g = this.spawnG
    g.clear()
    for (const s of this.spawnIcons) s.destroy()
    this.spawnIcons = []
    const r = spawnRadius(c, scale)
    const solid = (scale * c * 100) / CELL_AT_100 < SPAWN_SOLID_PERCENT
    const one = (p: Vec, alpha: number, selected: boolean) => {
      if (solid) g.circle(p.x, p.y, r).fill({ color: theme.spawnSolid.color, alpha: theme.spawnSolid.alpha * alpha })
      else {
        const ring = theme.spawnRing
        g.circle(p.x, p.y, r)
          .fill({ color: theme.spawnFill.color, alpha: theme.spawnFill.alpha * alpha })
          .stroke({ width: c * OUTLINE * 2, color: ring.color, alpha: ring.alpha * alpha })
        if (this.spawnIcon) {
          const icon = new Sprite(this.spawnIcon)
          icon.anchor.set(0.5)
          icon.position.set(p.x, p.y)
          icon.width = icon.height = c / 4
          icon.alpha = alpha
          this.spawn.addChild(icon)
          this.spawnIcons.push(icon)
        }
      }
      if (selected) {
        // a gap between the point and the ring: a solid blue point would merge with a blue ring
        const w = Math.max(c * SPAWN_SELECT, 2 / scale)
        g.circle(p.x, p.y, r + w * 1.5).stroke({ width: w, color: theme.selection.color, alpha: theme.selection.alpha * alpha })
      }
    }
    if (spawn.at) one(spawn.at, spawn.erasing ? ERASING_ALPHA : 1, spawn.selected)
    if (spawn.ghost) one(spawn.ghost, GHOST_ALPHA, false)
  }

  /** Door icons are hidden when the plate gets too small to hold them. */
  updateZoom(scale: number) {
    this.icons.visible = this.iconSize * scale >= MIN_ICON_PX
  }

  destroy() {
    this.container.destroy({ children: true })
  }
}
