// Cutting and encoding tiles; shared by the pyramid worker and its encoder workers.

// WebP where the browser can encode it (Chrome, Edge, Firefox); Safari falls back
let webp: boolean | null = null

export async function encode(c: OffscreenCanvas, opaque: boolean): Promise<Blob> {
  if (webp !== false) {
    const blob = await c.convertToBlob({ type: 'image/webp', quality: 0.9 })
    webp = blob.type === 'image/webp'
    if (webp) return blob
  }
  return c.convertToBlob(opaque ? { type: 'image/jpeg', quality: 0.9 } : { type: 'image/png' })
}

export type TileSource = ImageBitmap | OffscreenCanvas

/**
 * One tile of a level `sw × sh`: its inner square plus 1 px of the neighbors on every side (at
 * the picture edge the last pixels repeat). `src` holds the level rows from `top` on — the whole
 * level or one strip of it.
 */
export async function sliceTile(src: TileSource, top: number, sw: number, sh: number, col: number, row: number, size: number, opaque: boolean) {
  const x0 = col * size
  const y0 = row * size
  const w = Math.min(size, sw - x0)
  const h = Math.min(size, sh - y0)
  const c = new OffscreenCanvas(w + 2, h + 2)
  const ctx = c.getContext('2d')!
  ctx.imageSmoothingEnabled = false
  const sx = Math.max(0, x0 - 1)
  const sy = Math.max(0, y0 - 1)
  const ex = Math.min(sw, x0 + w + 1)
  const ey = Math.min(sh, y0 + h + 1)
  ctx.drawImage(src, sx, sy - top, ex - sx, ey - sy, sx - x0 + 1, sy - y0 + 1, ex - sx, ey - sy)
  if (x0 === 0) ctx.drawImage(c, 1, 0, 1, h + 2, 0, 0, 1, h + 2)
  if (x0 + w === sw) ctx.drawImage(c, w, 0, 1, h + 2, w + 1, 0, 1, h + 2)
  if (y0 === 0) ctx.drawImage(c, 0, 1, w + 2, 1, 0, 0, w + 2, 1)
  if (y0 + h === sh) ctx.drawImage(c, 0, h, w + 2, 1, 0, h + 1, w + 2, 1)
  return encode(c, opaque)
}

/** A row of tiles cut from a strip of the level: what one encoder worker does per task. */
export interface StripTask {
  strip: ImageBitmap
  top: number
  level: number
  row: number
  sw: number
  sh: number
  size: number
  opaque: boolean
}

export async function sliceStrip(t: StripTask) {
  const cols = Math.ceil(t.sw / t.size)
  const blobs: Blob[] = []
  for (let col = 0; col < cols; col++) blobs.push(await sliceTile(t.strip, t.top, t.sw, t.sh, col, t.row, t.size, t.opaque))
  t.strip.close()
  return blobs
}
