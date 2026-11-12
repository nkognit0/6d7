// What players have seen with static fog («открытый туман»): a byte per point of a low-resolution
// grid over the picture. Plain numbers, no browser: the game saves it, the server will keep it to
// send each player only what is open.
import type { FogShape } from './types'

/** The longer side of the mask in points; the shorter one keeps the picture's proportions. */
export const EXPLORED_SIDE = 512

/** The saved mask: `data[y * w + x]` is 255 where players have seen the map, 0 elsewhere. */
export interface ExploredData {
  w: number
  h: number
  data: Uint8Array
}

type Size = { width: number; height: number }

/** Two pictures with the same proportions share an explored mask (a replaced picture, QnA). */
export function sameProportions(a: Size, b: Size): boolean {
  return Math.abs(a.width / a.height - b.width / b.height) < 0.01 * (a.width / a.height)
}

/**
 * The mask of one map. Points are set where their centers fall into what players see and cleared
 * under new fog; listeners hear every change (the screen saves it, the renderer uploads it).
 */
export class ExploredMask {
  readonly w: number
  readonly h: number
  readonly data: Uint8Array
  /** grows with every change: the renderer uploads the mask again */
  version = 0
  // mask points per picture pixel, along x and y
  private kx: number
  private ky: number
  private listeners = new Set<() => void>()

  constructor(readonly image: Size, saved?: ExploredData | null) {
    const k = EXPLORED_SIDE / Math.max(image.width, image.height)
    const fits = saved && sameProportions(image, { width: saved.w, height: saved.h }) && saved.data.length === saved.w * saved.h
    this.w = fits ? saved.w : Math.max(1, Math.ceil(image.width * k))
    this.h = fits ? saved.h : Math.max(1, Math.ceil(image.height * k))
    this.data = fits ? saved.data.slice() : new Uint8Array(this.w * this.h)
    this.kx = this.w / image.width
    this.ky = this.h / image.height
  }

  /** A copy to save. */
  save(): ExploredData {
    return { w: this.w, h: this.h, data: this.data.slice() }
  }

  get empty(): boolean {
    return !this.data.some((v) => v)
  }

  /** Marks what is inside the polygons (x, y pairs in picture pixels) as seen. */
  reveal(polys: number[][]): boolean {
    let changed = false
    for (const p of polys) changed = this.fillPolygon(p) || changed
    return this.done(changed)
  }

  /**
   * New fog closes what it covers again: a brush stroke clears its points, «cover» clears all. An
   * erasing stroke changes nothing here.
   */
  hide(shape: FogShape): boolean {
    if (shape.mode === 'erase') return false
    if (shape.mode === 'cover') return this.clear()
    const p = shape.points
    let changed = false
    if (p.length === 2) changed = this.clearSegment(p[0], p[1], p[0], p[1], shape.radius)
    for (let i = 2; i < p.length; i += 2) changed = this.clearSegment(p[i - 2], p[i - 1], p[i], p[i + 1], shape.radius) || changed
    return this.done(changed)
  }

  clear(): boolean {
    const changed = this.data.some((v) => v)
    this.data.fill(0)
    return this.done(changed)
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn)
    return () => {
      this.listeners.delete(fn)
    }
  }

  private done(changed: boolean): boolean {
    if (changed) {
      this.version++
      for (const fn of this.listeners) fn()
    }
    return changed
  }

  // even-odd scanline fill by point centers
  private fillPolygon(p: number[]): boolean {
    const n = p.length / 2
    if (n < 3) return false
    let minY = Infinity
    let maxY = -Infinity
    for (let i = 1; i < p.length; i += 2) {
      minY = Math.min(minY, p[i])
      maxY = Math.max(maxY, p[i])
    }
    const y0 = Math.max(0, Math.ceil(minY * this.ky - 0.5))
    const y1 = Math.min(this.h - 1, Math.floor(maxY * this.ky - 0.5))
    const xs: number[] = []
    let changed = false
    for (let y = y0; y <= y1; y++) {
      const cy = (y + 0.5) / this.ky
      xs.length = 0
      for (let i = 0, j = n - 1; i < n; j = i++) {
        const ay = p[2 * i + 1]
        const by = p[2 * j + 1]
        if (ay > cy === by > cy) continue
        const ax = p[2 * i]
        const bx = p[2 * j]
        xs.push(ax + ((cy - ay) / (by - ay)) * (bx - ax))
      }
      xs.sort((a, b) => a - b)
      const row = y * this.w
      for (let k = 0; k + 1 < xs.length; k += 2) {
        const x0 = Math.max(0, Math.ceil(xs[k] * this.kx - 0.5))
        const x1 = Math.min(this.w - 1, Math.floor(xs[k + 1] * this.kx - 0.5))
        for (let x = x0; x <= x1; x++) {
          if (this.data[row + x] !== 255) {
            this.data[row + x] = 255
            changed = true
          }
        }
      }
    }
    return changed
  }

  // the points whose centers are within `r` of the segment (picture pixels)
  private clearSegment(ax: number, ay: number, bx: number, by: number, r: number): boolean {
    const x0 = Math.max(0, Math.floor((Math.min(ax, bx) - r) * this.kx))
    const x1 = Math.min(this.w - 1, Math.ceil((Math.max(ax, bx) + r) * this.kx))
    const y0 = Math.max(0, Math.floor((Math.min(ay, by) - r) * this.ky))
    const y1 = Math.min(this.h - 1, Math.ceil((Math.max(ay, by) + r) * this.ky))
    const dx = bx - ax
    const dy = by - ay
    const len2 = dx * dx + dy * dy
    let changed = false
    for (let y = y0; y <= y1; y++) {
      const cy = (y + 0.5) / this.ky
      for (let x = x0; x <= x1; x++) {
        const i = y * this.w + x
        if (!this.data[i]) continue
        const cx = (x + 0.5) / this.kx
        const t = len2 ? Math.max(0, Math.min(1, ((cx - ax) * dx + (cy - ay) * dy) / len2)) : 0
        const ex = ax + t * dx - cx
        const ey = ay + t * dy - cy
        if (ex * ex + ey * ey <= r * r) {
          this.data[i] = 0
          changed = true
        }
      }
    }
    return changed
  }
}
