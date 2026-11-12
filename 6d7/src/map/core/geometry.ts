import type { GridSettings, Pin, Vec } from './types'

/** One cell is a 5×5 ft square by the rules. */
export const FEET_PER_CELL = 5

/**
 * Pixels of the source image in one unit of the 1–10 grid scale. The standard is not chosen
 * yet (QnA, open questions): 1 = 50 px for now, change it here only.
 */
export const PX_PER_GRID_UNIT = 50

/** Cell size in pixels of the source image. */
export const cellPx = (grid: GridSettings) => grid.size * PX_PER_GRID_UNIT

export const feetToPx = (feet: number, grid: GridSettings) => (feet / FEET_PER_CELL) * cellPx(grid)

export function pinToImage(pin: Pin, grid: GridSettings): Vec {
  if (pin.space === 'image') return { x: pin.x, y: pin.y }
  const c = cellPx(grid)
  return { x: grid.offsetX + pin.u * c, y: grid.offsetY + pin.v * c }
}

/** Grid coordinates (cells, fractional) of an image point. */
export function imageToGrid(p: Vec, grid: GridSettings): { u: number; v: number } {
  const c = cellPx(grid)
  return { u: (p.x - grid.offsetX) / c, v: (p.y - grid.offsetY) / c }
}

/** Nearest grid node (corner of cells): walls and doors. */
export function nodePin(p: Vec, grid: GridSettings): Pin {
  const g = imageToGrid(p, grid)
  return { space: 'grid', u: Math.round(g.u), v: Math.round(g.v) }
}

/** Center of the cell under the point: tokens and the spawn point. */
export function cellPin(p: Vec, grid: GridSettings): Pin {
  const g = imageToGrid(p, grid)
  return { space: 'grid', u: Math.floor(g.u) + 0.5, v: Math.floor(g.v) + 0.5 }
}

export const imagePin = (p: Vec): Pin => ({ space: 'image', x: p.x, y: p.y })

export const samePin = (a: Pin, b: Pin) =>
  a.space === 'grid' && b.space === 'grid' ? a.u === b.u && a.v === b.v
    : a.space === 'image' && b.space === 'image' ? a.x === b.x && a.y === b.y
      : false

export const dist = (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.y - b.y)

/** Position of the projection of `p` on the segment a–b: 0 at a, 1 at b (not clamped). */
export function projectT(p: Vec, a: Vec, b: Vec): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len2 = dx * dx + dy * dy
  return len2 ? ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2 : 0
}

export function distToSegment(p: Vec, a: Vec, b: Vec): number {
  const t = Math.max(0, Math.min(1, projectT(p, a, b)))
  return Math.hypot(p.x - (a.x + (b.x - a.x) * t), p.y - (a.y + (b.y - a.y) * t))
}

/** Distance from a point to a polyline given as x, y pairs. */
export function distToPolyline(p: Vec, points: number[]): number {
  if (points.length < 4) return points.length ? Math.hypot(p.x - points[0], p.y - points[1]) : Infinity
  let best = Infinity
  for (let i = 0; i + 3 < points.length; i += 2) {
    best = Math.min(best, distToSegment(p, { x: points[i], y: points[i + 1] }, { x: points[i + 2], y: points[i + 3] }))
  }
  return best
}

/** Short unique id; works without a secure context (phones open the dev server over the LAN). */
export const newId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)
