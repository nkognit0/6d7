import { Container, Graphics } from 'pixi.js'
import { cellPx } from '../core/geometry'
import type { Drawing, GridSettings } from '../core/types'
import { ERASING_ALPHA } from './BuildLayer'
import type { Paint, MapTheme } from './theme'

/** Pencil width: 3 px at 100%, tied to the map like a Figma stroke. */
export const PENCIL = 3 / 128

export const drawingPaint = (d: Pick<Drawing, 'color'>, theme: MapTheme): Paint => (d.color === 'master' ? theme.master : theme.flow[d.color])

function strokeLine(g: Graphics, points: number[], width: number, paint: Paint) {
  if (points.length < 2) return
  if (points.length === 2) {
    g.circle(points[0], points[1], width / 2).fill({ color: paint.color, alpha: paint.alpha })
    return
  }
  g.moveTo(points[0], points[1])
  for (let i = 2; i < points.length; i += 2) g.lineTo(points[i], points[i + 1])
  g.stroke({ width, color: paint.color, alpha: paint.alpha, cap: 'round', join: 'round' })
}

/** Lines of the pencil: everything saved plus the line being drawn now. */
export class DrawLayer {
  readonly container = new Container()
  private saved = new Graphics()
  private live = new Graphics()

  constructor() {
    this.container.addChild(this.saved, this.live)
  }

  draw(drawings: Drawing[], grid: GridSettings, theme: MapTheme, erasing: string | null) {
    const w = cellPx(grid) * PENCIL
    this.saved.clear()
    for (const d of drawings) {
      const paint = drawingPaint(d, theme)
      strokeLine(this.saved, d.points, w, d.id === erasing ? { ...paint, alpha: paint.alpha * ERASING_ALPHA } : paint)
    }
  }

  drawLive(points: number[] | null, grid: GridSettings, paint: Paint) {
    this.live.clear()
    if (points) strokeLine(this.live, points, cellPx(grid) * PENCIL, paint)
  }

  destroy() {
    this.container.destroy({ children: true })
  }
}
