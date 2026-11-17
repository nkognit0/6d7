// A change of a seat by its fields (docs/data-model.md, «seat»): the fields of the sheet one by one,
// the other parts (spells, items, the companion) whole. Two people changing different fields of
// one sheet at once — the master's «Отдых для всех» while the player types — keep both changes;
// the journal and the network carry only what changed. No rules here: the campaign layer uses it.
import type { CompanionFields, ItemCell, Seat, SpellEntry } from './seat'

export interface SeatPatch {
  /** fields of the sheet set */
  sheet?: Record<string, unknown>
  /** fields of the sheet cleared */
  cleared?: string[]
  spells?: SpellEntry[]
  inventory?: (ItemCell | null)[]
  companion?: CompanionFields | null
  started?: boolean
}

const PARTS = ['spells', 'inventory', 'companion', 'started'] as const

const same = (a: unknown, b: unknown) => a === b || JSON.stringify(a) === JSON.stringify(b)
const emptySheet = (): Seat => ({ schema: 1, sheet: {}, spells: [], inventory: [], companion: null })

/** What turns `from` into `to`; null — nothing. Without `from` — the whole seat. */
export function diffSeat(from: Seat | undefined, to: Seat): SeatPatch | null {
  const a = from ?? emptySheet()
  const p: SeatPatch = {}
  const sheet: Record<string, unknown> = {}
  const before = a.sheet as Record<string, unknown>
  const after = to.sheet as Record<string, unknown>
  for (const k of Object.keys(after)) if (!(k in before) || !same(before[k], after[k])) sheet[k] = after[k]
  const cleared = Object.keys(before).filter((k) => !(k in after))
  if (Object.keys(sheet).length) p.sheet = sheet
  if (cleared.length) p.cleared = cleared
  for (const k of PARTS) {
    if (!from || !same(a[k], to[k])) Object.assign(p, { [k]: to[k] })
  }
  return Object.keys(p).length ? p : null
}

/** The seat with the change (a new object; the old one is left as it was). */
export function applySeatPatch(seat: Seat | undefined, p: SeatPatch): Seat {
  const s = seat ?? emptySheet()
  const sheet = { ...(s.sheet as Record<string, unknown>), ...(p.sheet ?? {}) }
  for (const k of p.cleared ?? []) delete sheet[k]
  const next: Seat = { ...s, sheet: sheet as Seat['sheet'] }
  for (const k of PARTS) if (k in p) Object.assign(next, { [k]: p[k] })
  return next
}

/** The change that takes `p` back, made on the seat before it. */
export function invertSeatPatch(seat: Seat, p: SeatPatch): SeatPatch {
  const before = seat.sheet as Record<string, unknown>
  const back: SeatPatch = {}
  const sheet: Record<string, unknown> = {}
  const cleared: string[] = []
  for (const k of Object.keys(p.sheet ?? {})) {
    if (k in before) sheet[k] = before[k]
    else cleared.push(k)
  }
  for (const k of p.cleared ?? []) if (k in before) sheet[k] = before[k]
  if (Object.keys(sheet).length) back.sheet = sheet
  if (cleared.length) back.cleared = cleared
  for (const k of PARTS) if (k in p) Object.assign(back, { [k]: seat[k] })
  return back
}
