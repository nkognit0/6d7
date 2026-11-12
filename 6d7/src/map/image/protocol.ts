// Messages between the page and the picture worker.

export interface TileBlob {
  level: number
  col: number
  row: number
  blob: Blob
}

/** A generated test dungeon: walls and doors along cell edges, in grid nodes. */
export interface TestMapLayout {
  cols: number
  rows: number
  cellPx: number
  walls: [number, number, number, number][]
  /** one cell edge each, lying on a wall of `walls` */
  doors: [number, number, number, number][]
  /** cell of the spawn point */
  spawn: [number, number]
}

export type WorkerRequest =
  | { type: 'build'; job: number; source: Blob; tileSize: number }
  | { type: 'test'; job: number; cols: number; rows: number; cellPx: number; seed: number; tileSize: number }

export type WorkerStage = 'decode' | 'draw' | 'tiles'

export type WorkerResponse =
  | { type: 'progress'; job: number; stage: WorkerStage; done: number; total: number }
  | {
      type: 'done'
      job: number
      width: number
      height: number
      levels: number
      tileSize: number
      tiles: TileBlob[]
      thumbnail: Blob
      layout?: TestMapLayout
      ms: number
    }
  | { type: 'error'; job: number; code: 'decode' | 'size' | 'other'; message: string }
