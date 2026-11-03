// «Экспорт листа»: the sheet as a JSON file of the old app's format, the pictures inside as data
// URLs — the old app and «Импорт листа» of the VTT (import.ts) both read it.
import type { DnDCharacter } from 'dnd-sheet'
import { getMedia } from '../media/media'
import { characterOf, type MediaRef, type Seat } from './seat'

const dataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result))
    r.onerror = () => reject(r.error)
    r.readAsDataURL(blob)
  })

async function inline<T extends Record<string, unknown>>(fields: T): Promise<T> {
  const out: Record<string, unknown> = { ...fields }
  for (const [k, v] of Object.entries(fields)) {
    if (typeof v !== 'string' || !v.startsWith('media:')) continue
    const blob = await getMedia(v as MediaRef)
    out[k] = blob ? await dataUrl(blob) : ''
  }
  return out as T
}

export async function exportCharacter(seat: Seat): Promise<Blob> {
  const c = characterOf(seat)
  const out: DnDCharacter = await inline(c)
  if (c.companion) out.companion = await inline(c.companion as Record<string, unknown>)
  return new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' })
}

/** The browser saves the sheet into the downloads. */
export async function downloadCharacter(seat: Seat, fallbackName: string): Promise<void> {
  const url = URL.createObjectURL(await exportCharacter(seat))
  const a = document.createElement('a')
  a.href = url
  a.download = `${String(seat.sheet.name || fallbackName).replace(/[\\/:*?"<>|]/g, '_')}.json`
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}
