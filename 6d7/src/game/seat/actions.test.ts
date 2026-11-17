import { describe, expect, it } from 'vitest'
import { maxSlotLevel, searchAvailable } from './actions'
import { emptySeat, type Seat } from './seat'

// a wizard of level 3: slots of the 1st and 2nd circles, one spell known already
function wizard(): Seat {
  const seat = emptySeat()
  return { ...seat, sheet: { classLevel: 'Волшебник 3', lvl1SpellSlotsTotal: '4', lvl2SpellSlotsTotal: '2' }, spells: [{ id: 'magic-missile' }] }
}

describe('the spells a character can learn', () => {
  it('are listed without a query too: by circle, up to the highest slot, not known yet', () => {
    const seat = wizard()
    const all = searchAvailable(seat, '')
    expect(maxSlotLevel(seat)).toBe(2)
    expect(all.length).toBeGreaterThan(30)
    expect(all.every((s) => s.level <= 2)).toBe(true)
    expect(all.some((s) => s.level === 2)).toBe(true)
    expect(all.map((s) => s.level)).toEqual([...all.map((s) => s.level)].sort((a, b) => a - b))
    expect(all.some((s) => s.id === 'magic-missile')).toBe(false)
  })

  it('a short query keeps every one that fits: the class is filtered before the list is cut', () => {
    const seat = wizard()
    const all = new Set(searchAvailable(seat, '').map((s) => s.id))
    const found = searchAvailable(seat, 'а')
    expect(found.length).toBeGreaterThan(30)
    expect(found.every((s) => all.has(s.id))).toBe(true)
  })
})
