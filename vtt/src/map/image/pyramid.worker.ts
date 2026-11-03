// Cuts a picture into a tile pyramid off the main thread: level 0 is the source, every next
// level is half as big (each 2×2 pixels averaged), down to one tile. A tile file holds its
// inner square plus 1 px of its neighbors on every side, so linear filtering leaves no seams.
// Encoding is the slow part, so rows of tiles go to a pool of encoder workers as strips.
import { MAX_IMAGE_SIDE } from './format'
import type { TileBlob, WorkerRequest, WorkerResponse } from './protocol'
import { encode, sliceStrip, type StripTask, type TileSource } from './slice'
import { generateTestMap } from './testMap'

const post = (m: WorkerResponse) => (self as unknown as Worker).postMessage(m)

async function pool<T>(items: T[], n: number, fn: (item: T, lane: number) => Promise<void>) {
  let next = 0
  const run = async (lane: number) => {
    while (next < items.length) await fn(items[next++], lane)
  }
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, (_, lane) => run(lane)))
}

// encoder workers, created once; without nested workers the strips are cut here
type Encoder = (task: StripTask) => Promise<Blob[]>
let encoders: Encoder[] | null = null

function getEncoders(): Encoder[] {
  if (encoders) return encoders
  const n = Math.max(2, Math.min(6, (navigator.hardwareConcurrency || 4) - 2))
  if (typeof Worker === 'undefined') return (encoders = Array.from({ length: n }, () => sliceStrip))
  encoders = Array.from({ length: n }, () => {
    const w = new Worker(new URL('./tile.worker.ts', import.meta.url), { type: 'module' })
    let seq = 0
    const waiting = new Map<number, (blobs: Blob[]) => void>()
    w.onmessage = (e: MessageEvent<{ id: number; blobs: Blob[] }>) => {
      waiting.get(e.data.id)?.(e.data.blobs)
      waiting.delete(e.data.id)
    }
    return (task: StripTask) =>
      new Promise<Blob[]>((resolve) => {
        const id = ++seq
        waiting.set(id, resolve)
        w.postMessage({ ...task, id }, [task.strip])
      })
  })
  return encoders
}

async function build(job: number, source: ImageBitmap, size: number, opaque: boolean, started: number) {
  const W = source.width
  const H = source.height
  const levels = Math.max(1, Math.ceil(Math.log2(Math.max(W, H) / size)) + 1)
  let total = 0
  for (let l = 0; l < levels; l++) total += Math.ceil(Math.ceil(W / 2 ** l) / size) * Math.ceil(Math.ceil(H / 2 ** l) / size)

  const encoderPool = getEncoders()
  const tiles: TileBlob[] = []
  let done = 0
  let lastPost = 0
  let src: TileSource = source
  let sw = W
  let sh = H
  for (let level = 0; level < levels; level++) {
    if (level > 0) {
      const nw = Math.max(1, Math.ceil(sw / 2))
      const nh = Math.max(1, Math.ceil(sh / 2))
      const c = new OffscreenCanvas(nw, nh)
      const ctx = c.getContext('2d')!
      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = 'high'
      ctx.drawImage(src, 0, 0, sw, sh, 0, 0, nw, nh)
      if (src instanceof OffscreenCanvas) src.width = src.height = 0
      else src.close()
      src = c
      sw = nw
      sh = nh
    }
    const levelSource = src
    const lw = sw
    const lh = sh
    const rows = Array.from({ length: Math.ceil(lh / size) }, (_, r) => r)
    // a strip is made only when an encoder is free, so at most one strip per encoder is in memory
    await pool(rows, encoderPool.length, async (row, lane) => {
      const top = Math.max(0, row * size - 1)
      const bottom = Math.min(lh, row * size + size + 1)
      const strip = await createImageBitmap(levelSource, 0, top, lw, bottom - top)
      const blobs = await encoderPool[lane]({ strip, top, level, row, sw: lw, sh: lh, size, opaque })
      blobs.forEach((blob, col) => tiles.push({ level, col, row, blob }))
      done += blobs.length
      const now = performance.now()
      if (now - lastPost > 100 || done === total) {
        lastPost = now
        post({ type: 'progress', job, stage: 'tiles', done, total })
      }
    })
  }

  // the smallest level doubles as the preview of the campaign tile
  const thumb = new OffscreenCanvas(sw, sh)
  thumb.getContext('2d')!.drawImage(src, 0, 0)
  if (src instanceof OffscreenCanvas) src.width = src.height = 0
  else src.close()
  const thumbnail = await encode(thumb, opaque)
  return { width: W, height: H, levels, tileSize: size, tiles, thumbnail, ms: performance.now() - started }
}

self.onmessage = async (e: MessageEvent<WorkerRequest>) => {
  const req = e.data
  const started = performance.now()
  try {
    if (req.type === 'build') {
      post({ type: 'progress', job: req.job, stage: 'decode', done: 0, total: 1 })
      let bitmap: ImageBitmap
      try {
        // EXIF rotation and color profile are applied by the browser; animated files give the first frame
        bitmap = await createImageBitmap(req.source, { imageOrientation: 'from-image', colorSpaceConversion: 'default' } as ImageBitmapOptions)
      } catch (err) {
        post({ type: 'error', job: req.job, code: 'decode', message: String(err) })
        return
      }
      if (Math.max(bitmap.width, bitmap.height) > MAX_IMAGE_SIDE) {
        post({ type: 'error', job: req.job, code: 'size', message: `${bitmap.width}×${bitmap.height}` })
        bitmap.close()
        return
      }
      const opaque = req.source.type === 'image/jpeg'
      const result = await build(req.job, bitmap, req.tileSize, opaque, started)
      post({ type: 'done', job: req.job, ...result })
    } else {
      post({ type: 'progress', job: req.job, stage: 'draw', done: 0, total: 1 })
      const { canvas, layout } = generateTestMap(req.cols, req.rows, req.cellPx, req.seed)
      const bitmap = canvas.transferToImageBitmap()
      const result = await build(req.job, bitmap, req.tileSize, true, started)
      post({ type: 'done', job: req.job, ...result, layout })
    }
  } catch (err) {
    post({ type: 'error', job: req.job, code: 'other', message: String(err) })
  }
}
