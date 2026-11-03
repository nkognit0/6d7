import { newId } from '../core/geometry'
import type { MapImageInfo, TileProvider } from '../core/types'
import { sniffFormat, type ImageFormat } from './format'
import type { TestMapLayout, TileBlob, WorkerRequest, WorkerResponse, WorkerStage } from './protocol'

/** Inner size of a tile of the pyramid. */
export const TILE_SIZE = 512

export type ImportProgress = (stage: WorkerStage, fraction: number) => void

export class MapImageError extends Error {
  constructor(public code: 'format' | 'decode' | 'size' | 'other', message: string = code) {
    super(message)
  }
}

export interface ImportedImage {
  info: MapImageInfo
  /** the smallest level: preview of the campaign tile */
  thumbnail: Blob
  /** the uploaded file as is: goes into the campaign archive */
  original: Blob | null
  format: ImageFormat | null
  /** bytes of all tiles */
  bytes: number
  ms: number
}

/** Tiles kept in memory (the editor before saving). The server will serve them by URL later. */
export class MemoryTileProvider implements TileProvider {
  private tiles = new Map<string, Blob>()

  add(imageId: string, tiles: TileBlob[]) {
    for (const t of tiles) this.tiles.set(`${imageId}/${t.level}/${t.col}/${t.row}`, t.blob)
  }

  async load(image: MapImageInfo, level: number, col: number, row: number): Promise<ImageBitmap> {
    const blob = this.tiles.get(`${image.id}/${level}/${col}/${row}`)
    if (!blob) throw new Error(`no tile ${level}/${col}/${row}`)
    return createImageBitmap(blob)
  }
}

let worker: Worker | null = null
let jobs = 0
const pending = new Map<number, { resolve: (r: Extract<WorkerResponse, { type: 'done' }>) => void; reject: (e: Error) => void; progress?: ImportProgress }>()

type Request = WorkerRequest extends infer R ? (R extends WorkerRequest ? Omit<R, 'job'> : never) : never

function run(req: Request, progress?: ImportProgress) {
  if (!worker) {
    worker = new Worker(new URL('./pyramid.worker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
      const m = e.data
      const p = pending.get(m.job)
      if (!p) return
      if (m.type === 'progress') p.progress?.(m.stage, m.total ? m.done / m.total : 0)
      else {
        pending.delete(m.job)
        if (m.type === 'done') p.resolve(m)
        else p.reject(new MapImageError(m.code, m.message))
      }
    }
  }
  const job = ++jobs
  return new Promise<Extract<WorkerResponse, { type: 'done' }>>((resolve, reject) => {
    pending.set(job, { resolve, reject, progress })
    worker!.postMessage({ ...req, job } as WorkerRequest)
  })
}

function imported(r: Extract<WorkerResponse, { type: 'done' }>, provider: MemoryTileProvider, original: Blob | null, format: ImageFormat | null): ImportedImage {
  const info: MapImageInfo = { id: newId(), width: r.width, height: r.height, tileSize: r.tileSize, levels: r.levels }
  provider.add(info.id, r.tiles)
  const bytes = r.tiles.reduce((s, t) => s + t.blob.size, 0)
  return { info, thumbnail: r.thumbnail, original, format, bytes, ms: r.ms }
}

/** Uploads a map picture (PNG, JPEG, WebP, AVIF): checks the format and builds the tile pyramid. */
export async function importMapImage(file: Blob, provider: MemoryTileProvider, progress?: ImportProgress): Promise<ImportedImage> {
  const format = sniffFormat(new Uint8Array(await file.slice(0, 32).arrayBuffer()))
  if (!format) throw new MapImageError('format')
  const r = await run({ type: 'build', source: file, tileSize: TILE_SIZE }, progress)
  return imported(r, provider, file, format)
}

/** A generated test dungeon of `cols × rows` cells, with its walls and doors. */
export async function createTestMap(
  opts: { cols: number; rows: number; cellPx: number; seed?: number },
  provider: MemoryTileProvider,
  progress?: ImportProgress
): Promise<ImportedImage & { layout: TestMapLayout }> {
  const r = await run({ type: 'test', cols: opts.cols, rows: opts.rows, cellPx: opts.cellPx, seed: opts.seed ?? 7, tileSize: TILE_SIZE }, progress)
  return { ...imported(r, provider, null, null), layout: r.layout! }
}
