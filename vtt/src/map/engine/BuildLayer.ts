import { Container, Graphics, GraphicsPath, Sprite, type Texture } from 'pixi.js'
import doorSvg from '../../ui/icons/svg/icon.16/door.svg?raw'
import homeSvg from '../../ui/icons/svg/icon.16/home.svg?raw'
import { cellPx, pinToImage } from '../core/geometry'
import type { MapScene, Vec, WallKind } from '../core/types'
import { withoutDoors, type Segment } from '../core/visibility'
import type { MapTheme } from './theme'
import { svgTexture } from './textures'

// Sizes are parts of a cell, so lines scale with the map. At 100% (128 px cell): wall 8 px,
// outline 1 px, door plate 16 px.
const WALL = 1 / 16
const OUTLINE = 1 / 128
const DOOR = 1 / 8
const DASH = 1 / 8
const GAP = 1 / 16
/** below this size on screen the door icon is hidden */
const MIN_ICON_PX = 10
/** an object under the eraser fades: the walls are red already, a red highlight would not show */
export const ERASING_ALPHA = 0.35

function dashes(path: GraphicsPath, segs: Segment[], dash: number, gap: number) {
  for (const [x1, y1, x2, y2] of segs) {
    const len = Math.hypot(x2 - x1, y2 - y1)
    if (!len) continue
    const dx = (x2 - x1) / len
    const dy = (y2 - y1) / len
    for (let s = 0; s < len; s += dash + gap) {
      const e = Math.min(len, s + dash)
      path.moveTo(x1 + dx * s, y1 + dy * s).lineTo(x1 + dx * e, y1 + dy * e)
    }
  }
}

/** Walls or barriers in their map style; also used for the preview while a wall is drawn. */
export function strokeWalls(g: Graphics, segs: Segment[], kind: WallKind, cell: number, theme: MapTheme, alpha = 1) {
  const path = new GraphicsPath()
  if (kind === 'wall') for (const s of segs) path.moveTo(s[0], s[1]).lineTo(s[2], s[3])
  else dashes(path, segs, cell * DASH, cell * GAP)
  const width = cell * WALL
  const color = kind === 'wall' ? theme.wall : theme.barrier
  g.path(path).stroke({ width: width + cell * OUTLINE * 2, color: theme.wallOutline.color, alpha: theme.wallOutline.alpha * alpha, cap: 'round', join: 'round' })
  g.path(path).stroke({ width, color: color.color, alpha: color.alpha * alpha, cap: kind === 'wall' ? 'round' : 'butt', join: 'round' })
}

// corners of the door plate on the edge a–b, a little shorter than the edge
function plate(a: Vec, b: Vec, cell: number): number[] {
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

/**
 * Walls, barriers, doors and the spawn point. Players see walls and doors (barriers and the
 * spawn point are the master's).
 */
export class BuildLayer {
  readonly container = new Container()
  private g = new Graphics()
  private icons = new Container()
  private doorIcon: Texture | null = null
  private spawnIcon: Texture | null = null
  private iconSize = 0

  constructor() {
    this.container.addChild(this.g, this.icons)
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
    const outline = theme.doorOutline
    for (const d of scene.doors) {
      if (d.open && !master) continue
      const a = at(d.a)
      const b = at(d.b)
      const k = fade(d.id) * (d.open ? 0.6 : 1)
      const corners = plate(a, b, c)
      if (d.open) {
        g.poly(corners).stroke({ width: c * OUTLINE * 2, color: outline.color, alpha: outline.alpha * k })
      } else {
        const fill = state.hoverDoor === d.id ? theme.doorHover : theme.doorFill
        g.poly(corners).fill({ color: fill.color, alpha: fill.alpha * k }).stroke({ width: c * OUTLINE * 2, color: outline.color, alpha: outline.alpha * k })
      }
      if (this.doorIcon) {
        const icon = new Sprite(this.doorIcon)
        icon.anchor.set(0.5)
        icon.position.set((a.x + b.x) / 2, (a.y + b.y) / 2)
        icon.width = icon.height = iconSize
        icon.alpha = k
        this.icons.addChild(icon)
      }
    }

    if (master && scene.spawn) {
      const p = at(scene.spawn)
      const k = fade('spawn')
      const ring = theme.spawnRing
      g.circle(p.x, p.y, c * 0.3)
        .fill({ color: theme.spawnFill.color, alpha: theme.spawnFill.alpha * k })
        .stroke({ width: c * OUTLINE * 2, color: ring.color, alpha: ring.alpha * k })
      if (this.spawnIcon) {
        const icon = new Sprite(this.spawnIcon)
        icon.anchor.set(0.5)
        icon.position.set(p.x, p.y)
        icon.width = icon.height = c / 4
        icon.alpha = k
        this.icons.addChild(icon)
      }
    }
    this.iconSize = iconSize
  }

  /** Door icons are hidden when the plate gets too small to hold them. */
  updateZoom(scale: number) {
    this.icons.visible = this.iconSize * scale >= MIN_ICON_PX
  }

  destroy() {
    this.container.destroy({ children: true })
  }
}
