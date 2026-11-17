import { describe, expect, it } from 'vitest'
import { applySeatPatch, diffSeat, invertSeatPatch } from './patch'
import type { Seat } from './seat'

const seat = (sheet: Record<string, unknown>, extra: Partial<Seat> = {}): Seat =>
  ({ schema: 1, sheet, spells: [], inventory: [null, null], companion: null, ...extra }) as Seat

describe('a change of a seat by its fields', () => {
  it('takes only what changed: fields of the sheet one by one, the other parts whole', () => {
    const a = seat({ name: 'Арина', hp: 12, notes: 'старые' })
    const b = seat({ name: 'Арина', hp: 9, bonds: 'новое' }, { inventory: [{ uid: 'u', item: 'rope' }, null] })
    expect(diffSeat(a, b)).toEqual({ sheet: { hp: 9, bonds: 'новое' }, cleared: ['notes'], inventory: [{ uid: 'u', item: 'rope' }, null] })
    expect(diffSeat(a, structuredClone(a))).toBeNull()
    expect(applySeatPatch(a, diffSeat(a, b)!)).toEqual(b)
  })

  it('without the seat before, it is the whole seat', () => {
    const b = seat({ name: 'Арина' }, { started: true })
    expect(applySeatPatch(undefined, diffSeat(undefined, b)!)).toEqual(b)
  })

  it('keeps two changes of different fields made at once, in either order', () => {
    const base = seat({ hp: 3, notes: '' })
    const typing = diffSeat(base, seat({ hp: 3, notes: 'идём к храму' }))!
    const rest = diffSeat(base, seat({ hp: 12, notes: '' }))!
    const want = seat({ hp: 12, notes: 'идём к храму' })
    expect(applySeatPatch(applySeatPatch(base, typing), rest)).toEqual(want)
    expect(applySeatPatch(applySeatPatch(base, rest), typing)).toEqual(want)
  })

  it('is taken back by its inverse', () => {
    const a = seat({ name: 'Арина', hp: 12, notes: 'старые' }, { started: true })
    const b = seat({ name: 'Арина', hp: 9, bonds: 'новое' }, { started: false })
    const p = diffSeat(a, b)!
    expect(applySeatPatch(applySeatPatch(a, p), invertSeatPatch(a, p))).toEqual(a)
  })
})
