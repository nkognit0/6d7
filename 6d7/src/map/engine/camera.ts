// Each client has its own camera: screen = world · scale + (x, y), in CSS pixels. World units
// are pixels of the source image.

/** At 100% a cell takes 128 px of the screen (QnA, «Карта»). */
export const CELL_AT_100 = 128
/** On touch screens zooming goes at least this far, even past the picture's own pixels. */
export const MIN_TOUCH_CELL = 64
/** How far the map may be dragged past its edge, to uncover what the interface hides. */
const OVERSCROLL = 240
const OVERSCROLL_SHARE = 0.3

export interface CameraBounds {
  view: { w: number; h: number }
  image: { width: number; height: number } | null
  cell: number
  dpr: number
  touch: boolean
}

export class Camera {
  scale = 1
  x = 0
  y = 0

  toWorld(sx: number, sy: number) {
    return { x: (sx - this.x) / this.scale, y: (sy - this.y) / this.scale }
  }

  toScreen(wx: number, wy: number) {
    return { x: wx * this.scale + this.x, y: wy * this.scale + this.y }
  }

  /** Zoom in percent: how big a cell is against 128 px. */
  percent(cell: number) {
    return (this.scale * cell * 100) / CELL_AT_100
  }

  scaleForPercent(percent: number, cell: number) {
    return (percent * CELL_AT_100) / (100 * cell)
  }

  /**
   * Zoom range: out until the whole map fits, in until one picture pixel is one screen pixel
   * (on touch screens at least a 64 px cell). Without a picture: 25–200%.
   */
  limits(b: CameraBounds) {
    if (!b.image) return { min: this.scaleForPercent(25, b.cell), max: this.scaleForPercent(200, b.cell) }
    let max = 1 / b.dpr
    if (b.touch) max = Math.max(max, MIN_TOUCH_CELL / b.cell)
    const fit = b.view.w > 0 && b.view.h > 0 ? Math.min(b.view.w / b.image.width, b.view.h / b.image.height) : max
    return { min: Math.min(fit, max), max }
  }

  /** Zooms keeping the world point under (sx, sy) in place. */
  zoomAt(scale: number, sx: number, sy: number, b: CameraBounds) {
    const { min, max } = this.limits(b)
    const next = Math.min(max, Math.max(min, scale))
    const w = this.toWorld(sx, sy)
    this.scale = next
    this.x = sx - w.x * next
    this.y = sy - w.y * next
    this.clamp(b)
  }

  panBy(dx: number, dy: number, b: CameraBounds) {
    this.x += dx
    this.y += dy
    this.clamp(b)
  }

  /** The whole map in view, centered. */
  fit(b: CameraBounds) {
    const { min } = this.limits(b)
    this.scale = min
    const w = b.image ? b.image.width : 0
    const h = b.image ? b.image.height : 0
    this.x = (b.view.w - w * min) / 2
    this.y = (b.view.h - h * min) / 2
    this.clamp(b)
  }

  /** Keeps the zoom in range and the map on screen (with a little overscroll). */
  clamp(b: CameraBounds) {
    const { min, max } = this.limits(b)
    if (this.scale < min || this.scale > max) {
      const cx = b.view.w / 2
      const cy = b.view.h / 2
      const w = this.toWorld(cx, cy)
      this.scale = Math.min(max, Math.max(min, this.scale))
      this.x = cx - w.x * this.scale
      this.y = cy - w.y * this.scale
    }
    if (!b.image) return
    const axis = (pos: number, size: number, view: number) => {
      const o = Math.min(OVERSCROLL, view * OVERSCROLL_SHARE)
      const lo = Math.min(o, view - o - size)
      const hi = Math.max(o, view - o - size)
      return Math.min(hi, Math.max(lo, pos))
    }
    this.x = axis(this.x, b.image.width * this.scale, b.view.w)
    this.y = axis(this.y, b.image.height * this.scale, b.view.h)
  }
}
