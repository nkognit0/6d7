// What a player does with the inventories of a seat. Items: get, buy, equip, attune, delete — the
// armour class and what magic items give follow (the old app's rules logic). Spells: learn,
// prepare, forget, spend and reset slots. Search shows the spells of the character's lists.
import { byId, classFeatures, nameOf, type SpellData } from '@app/data'
import { gearPatch } from '@app/inventory/gear'
import { pay, walletFields, walletOf } from '@app/inventory/inventory'
import { attunementLimit, needsAttunement } from '@app/inventory/magic'
import { classEntries } from '@app/levelup/read'
import { searchSpells } from '@app/spells/spells'
import { bagOfCells, characterOf, newUid, spellLevel, withCharacter, type ItemCell, type Seat } from './seat'

// ---- items

/** The seat with new cells: the sheet follows what is in use. */
export function withCells(seat: Seat, cells: (ItemCell | null)[]): Seat {
  const c = characterOf(seat)
  return withCharacter({ ...seat, inventory: cells }, { ...c, ...gearPatch(c, bagOfCells(cells)) })
}

const edit = (seat: Seat, uid: string, fn: (c: ItemCell) => ItemCell | null) =>
  withCells(seat, seat.inventory.map((c) => (c?.uid === uid ? fn(c) : c)))

/** Equipped or not; attunement goes with it (an attuned thing is always in use). */
export const setEquipped = (seat: Seat, uid: string, on: boolean) =>
  edit(seat, uid, (c) => ({ ...c, equipped: on || undefined, attuned: on ? c.attuned : undefined }))
export const setAttuned = (seat: Seat, uid: string, on: boolean) =>
  edit(seat, uid, (c) => ({ ...c, attuned: on || undefined, equipped: on ? true : c.equipped }))
export const removeCell = (seat: Seat, uid: string) => edit(seat, uid, () => null)

/** Into the first free cell; null when the inventory is full. */
export function addThing(seat: Seat, item: string): Seat | null {
  const free = seat.inventory.indexOf(null)
  if (free < 0) return null
  const cells = [...seat.inventory]
  cells[free] = { uid: newUid(), item }
  return withCells(seat, cells)
}

/** Paid from the coins; a string says why it cannot be bought. */
export function buyThing(seat: Seat, item: string): Seat | 'price' | 'money' | 'full' {
  const cost = byId.item[item]?.cost_cp
  if (!cost) return 'price'
  const wallet = pay(walletOf(seat.sheet), cost)
  if (!wallet) return 'money'
  const next = addThing(seat, item)
  if (!next) return 'full'
  return { ...next, sheet: { ...next.sheet, ...walletFields(next.sheet, wallet) } }
}

export const attunable = (c: ItemCell) => needsAttunement(c.item ? { id: c.item } : null)
export const attunedCount = (seat: Seat) => seat.inventory.filter((c) => c?.attuned).length
export const attunementMax = (seat: Seat) => attunementLimit(characterOf(seat))

// ---- spells

/** The spell lists of the character's classes and subclasses (Eldritch Knight: the wizard's). */
function spellLists(seat: Seat): Set<string> {
  const out = new Set<string>()
  for (const e of classEntries(seat.sheet) || []) {
    if (e.cls.spellcasting) out.add(e.cls.spellcasting.list)
    if (e.subclass?.spellcasting) out.add(e.subclass.spellcasting.list)
    for (const g of e.cls.level_up_grants) if (g.extra_spell_lists && (g.level ?? 99) <= e.level) g.extra_spell_lists.forEach((l) => out.add(l))
  }
  return out
}

/** The highest spell slot the sheet has (Pact Magic included). */
export function maxSlotLevel(seat: Seat): number {
  let max = Number(seat.sheet.pactSlotLevel) || 0
  for (let l = 1; l <= 9; l++) if (Number(seat.sheet[`lvl${l}SpellSlotsTotal`]) > 0) max = Math.max(max, l)
  return max
}

/** Search among the spells the character can learn: its lists, up to its highest slot. */
export function searchAvailable(seat: Seat, query: string): SpellData[] {
  const lists = spellLists(seat)
  const max = maxSlotLevel(seat)
  const known = new Set(seat.spells.map((e) => e.id))
  return searchSpells(query, 200).filter((s) => !known.has(s.id) && s.level <= max && s.classes.some((l) => lists.has(l))).slice(0, 30)
}

export const learnSpell = (seat: Seat, id: string): Seat =>
  seat.spells.some((e) => e.id === id) ? seat : { ...seat, spells: [...seat.spells, { id }] }
export const forgetSpell = (seat: Seat, id: string): Seat => ({ ...seat, spells: seat.spells.filter((e) => e.id !== id) })
export const togglePrepared = (seat: Seat, id: string): Seat =>
  ({ ...seat, spells: seat.spells.map((e) => (e.id === id ? { ...e, prepared: !e.prepared || undefined } : e)) })

// spells a class feature keeps prepared (they do not count against the limit); the sheet writes
// them without a tag
const FEATURE_SPELLS: Record<string, string[]> = {
  'druid-druidic': ['speak-with-animals'],
  'ranger-favored-enemy': ['hunters-mark'],
  'paladin-paladins-smite': ['divine-smite'],
  'paladin-faithful-steed': ['find-steed'],
  'warlock-contact-patron': ['contact-other-plane'],
  'bard-words-of-creation': ['power-word-heal', 'power-word-kill']
}

/** Spells always prepared by a class feature, with the feature's name. */
export function featurePrepared(seat: Seat): Map<string, string> {
  const out = new Map<string, string>()
  for (const e of classEntries(seat.sheet) || []) {
    for (const f of classFeatures) {
      if (f.class !== e.cls.id || (f.levels[0] ?? 99) > e.level) continue
      for (const id of FEATURE_SPELLS[f.id] || []) out.set(id, nameOf(f))
    }
  }
  return out
}

/** Prepared by choice: the ones a subclass, a species or a class feature keeps prepared do not count. */
export function preparedCount(seat: Seat): number {
  const always = featurePrepared(seat)
  return seat.spells.filter((e) => e.prepared && !e.tag && !always.has(e.id) && spellLevel(e) > 0).length
}
/** «Друид 6, Волшебник 3» — the sum. */
export const preparedMax = (seat: Seat) => (String(seat.sheet.preparedSpellsTotal ?? '').match(/\d+/g) || []).reduce((s, n) => s + Number(n), 0)

// ---- slots: the sheet's fields, Pact Magic apart when the hero has slots of another class

export const slotTotal = (seat: Seat, level: number) => Number(seat.sheet[`lvl${level}SpellSlotsTotal`]) || 0
export const slotUsed = (seat: Seat, level: number) => Number(seat.sheet[`lvl${level}SpellSlotsUsed`]) || 0
export const setSlotUsed = (seat: Seat, level: number, used: number): Seat => ({ ...seat, sheet: { ...seat.sheet, [`lvl${level}SpellSlotsUsed`]: used } })
export const setPactUsed = (seat: Seat, used: number): Seat => ({ ...seat, sheet: { ...seat.sheet, pactSlotsUsed: used } })
