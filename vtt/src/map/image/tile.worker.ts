// Encoder worker: cuts one strip of a pyramid level into tiles. Several run side by side, so
// encoding (the slowest part of an upload) uses all cores.
import { sliceStrip, type StripTask } from './slice'

self.onmessage = async (e: MessageEvent<StripTask & { id: number }>) => {
  const blobs = await sliceStrip(e.data)
  ;(self as unknown as Worker).postMessage({ id: e.data.id, blobs })
}
