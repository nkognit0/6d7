// A sheet of the old app (its JSON export) into a seat: the spells get their ids, the things on
// the hero become equipped cells, and the pictures kept in the sheet as data URLs go to the media
// store, so the fields keep only references.
import type { DnDCharacter } from 'dnd-sheet'
import { storePicture } from '../media/media'
import { seatFromCharacter, type Seat } from './seat'

async function storeFields<T extends Record<string, unknown>>(fields: T): Promise<T> {
  const out: Record<string, unknown> = { ...fields }
  for (const [k, v] of Object.entries(fields)) {
    if (typeof v === 'string' && v.startsWith('data:image/')) out[k] = await storePicture(v).catch(() => '')
  }
  return out as T
}

export async function importCharacter(c: DnDCharacter): Promise<Seat> {
  const seat = seatFromCharacter(c)
  return {
    ...seat,
    sheet: await storeFields(seat.sheet),
    companion: seat.companion ? await storeFields(seat.companion) : null
  }
}
