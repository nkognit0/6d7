// What a player keeps in a campaign (docs/data-model.md, «seat»): the free fields of the sheet
// (a picture field — the portrait, the emblem — keeps a reference to the media store), the
// spells by their database ids, the item cells (no places on the hero: a thing in use is marked
// «equipped») and the companion sheet.
// The rules logic of the old app (@app) works on its flat sheet; `characterOf` builds that sheet
// from a seat, `withCharacter` takes its changes back, `seatFromCharacter` imports an old sheet.
import type { DnDCharacter, DnDSpell } from 'dnd-sheet'
import { byId, nameOf, spells } from '@app/data'
import { INVENTORY_SIZE, inventoryOf, type Slot } from '@app/inventory/inventory'
import { NO_WORN, kindOf, twoHanded, wornOf, type Bag, type Worn } from '@app/inventory/worn'

/** A file of the media store: «media:» and the SHA-256 of its bytes. */
export type MediaRef = `media:${string}`

/** A spell of the character: a database id, or «custom-…» with its own name and level. */
export interface SpellEntry {
  id: string
  prepared?: boolean
  /** where it comes from, as the sheet writes it: «подкласс», «вид», «черта» */
  tag?: string
  name?: string
  level?: number
}

export type CompanionFields = Record<string, string | boolean | undefined>

/** A cell of the item inventory: a database item or a thing of the player's own. */
export interface ItemCell {
  uid: string
  item?: string
  name?: string
  equipped?: boolean
  attuned?: boolean
}

export interface Seat {
  schema: 1
  /** the free fields of the sheet, all editable (resources, exhaustion, slots and Wild Shape forms too) */
  sheet: DnDCharacter
  spells: SpellEntry[]
  inventory: (ItemCell | null)[]
  /** the companion sheet (its picture in the field «portrait») */
  companion: CompanionFields | null
  /** the player pressed «Начать игру»: the game opens on the map, not on the sheet */
  started?: boolean
}

export const SPELL_LISTS = ['cantrips', 'lvl1Spells', 'lvl2Spells', 'lvl3Spells', 'lvl4Spells', 'lvl5Spells', 'lvl6Spells', 'lvl7Spells', 'lvl8Spells', 'lvl9Spells']
// keys of the old sheet that the seat keeps in its own parts (the equipment text follows the cells)
const OWN_PARTS = new Set(['inventory', 'worn', 'companion', 'equipment', 'equipment2', ...SPELL_LISTS])

export const newUid = () => crypto.randomUUID()
export const emptySeat = (): Seat => ({ schema: 1, sheet: {}, spells: [], inventory: Array(INVENTORY_SIZE).fill(null), companion: null })

// ---- spells

const normName = (s: string) => s.toLowerCase().replace(/ё/g, 'е').replace(/[«»"'’]/g, '').replace(/\s+/g, ' ').trim()
const spellByName = new Map<string, string>()
for (const s of spells) for (const n of [s.name_ru, s.name]) if (n) spellByName.set(normName(n), s.id)

export const spellLevel = (e: SpellEntry) => byId.spell[e.id]?.level ?? e.level ?? 0
export const spellName = (e: SpellEntry) => nameOf(byId.spell[e.id]) || e.name || e.id

// «Огненный снаряд (подкласс)» → the database spell and the tag; an unknown name stays the player's own
function entryOfRow(row: DnDSpell, level: number, keep: SpellEntry[]): SpellEntry | null {
  const raw = String(row?.name ?? '').trim()
  if (!raw) return null
  const [, name, tag] = raw.match(/^(.*?)\s*(?:\(([^)]*)\))?$/) || [raw, raw]
  const id = spellByName.get(normName(name)) ?? spellByName.get(normName(raw))
  const prepared = level > 0 && Boolean(row.prepared)
  if (id) return { id, ...(prepared ? { prepared } : {}), ...(tag && spellByName.get(normName(name)) ? { tag: tag.trim() } : {}) }
  const own = keep.find((e) => e.id.startsWith('custom-') && normName(e.name || '') === normName(raw))
  return { id: own?.id ?? `custom-${newUid()}`, name: raw, level, ...(prepared ? { prepared } : {}) }
}

function spellRows(list: SpellEntry[], level: number): DnDSpell[] {
  return list.filter((e) => spellLevel(e) === level).map((e) => ({ name: spellName(e) + (e.tag ? ` (${e.tag})` : ''), prepared: Boolean(e.prepared) }))
}

// ---- items: the cells, and the places the old logic expects, filled from what is in use

const slotOf = (c: ItemCell): Slot => ({ ...(c.item ? { id: c.item } : { name: c.name || '' }), ...(c.equipped ? { equipped: true } : {}), ...(c.attuned ? { attuned: true } : {}) }) as Slot

/**
 * The old app's bag for the rules logic: armor, a shield and weapons in use stand in their places
 * (the armour class and the attack rows follow them); everything else stays in its cell.
 */
export function bagOfCells(cells: (ItemCell | null)[]): Bag {
  const out: (Slot | null)[] = cells.map((c) => (c ? slotOf(c) : null))
  const worn: Worn = { ...NO_WORN }
  const put = (i: number, place: keyof Worn) => {
    worn[place] = out[i]
    out[i] = null
  }
  out.forEach((s, i) => {
    if (!s?.equipped && !s?.attuned) return
    const kind = kindOf(s)
    if (kind === 'armor' && !worn.armor) put(i, 'armor')
    else if (kind === 'shield' && !worn.off1) put(i, 'off1')
    else if (kind === 'weapon' || kind === 'held') {
      const place = !worn.main1 ? 'main1' : !worn.main2 ? 'main2' : !worn.off2 && !twoHanded(s) ? 'off2' : null
      if (place) put(i, place)
    }
  })
  return { cells: out, worn }
}

// the cells of an old sheet: things on the hero become equipped things in free cells
function cellsOfCharacter(c: DnDCharacter): (ItemCell | null)[] {
  const cell = (s: Slot | null, inUse = false): ItemCell | null =>
    s ? { uid: newUid(), ...(s.id ? { item: s.id } : { name: s.name }), ...(s.equipped || inUse ? { equipped: true } : {}), ...(s.attuned ? { attuned: true } : {}) } : null
  const out = inventoryOf(c).map((s) => cell(s))
  for (const s of Object.values(wornOf(c))) {
    const free = out.indexOf(null)
    if (s && free >= 0) out[free] = cell(s, true)
  }
  return out
}

// ---- the flat sheet for the rules logic, and back

export function characterOf(seat: Seat): DnDCharacter {
  const bag = bagOfCells(seat.inventory)
  const c: DnDCharacter = { ...seat.sheet, inventory: bag.cells, worn: bag.worn }
  SPELL_LISTS.forEach((key, level) => (c[key] = spellRows(seat.spells, level)))
  if (seat.companion) c.companion = { ...seat.companion }
  return c
}

/** The seat after the rules logic changed its flat sheet (a rest, a level, a magic item put on). */
export function withCharacter(seat: Seat, c: DnDCharacter): Seat {
  const before = characterOf(seat)
  const sheet: DnDCharacter = {}
  for (const [k, v] of Object.entries(c)) if (!OWN_PARTS.has(k) && v !== undefined) sheet[k] = v
  const listsChanged = SPELL_LISTS.some((k) => JSON.stringify(c[k] || []) !== JSON.stringify(before[k] || []))
  const spellsNow = listsChanged
    ? SPELL_LISTS.flatMap((k, level) => ((c[k] || []) as DnDSpell[]).map((r) => entryOfRow(r, level, seat.spells)).filter((e): e is SpellEntry => !!e))
    : seat.spells
  const companion = c.companion ? { ...(c.companion as CompanionFields) } : null
  return { ...seat, sheet, spells: spellsNow, companion }
}

/** A sheet of the old app (or of an old export) as a seat; its pictures stay data URLs until stored (import.ts). */
export function seatFromCharacter(c: DnDCharacter): Seat {
  // the old spell lists differ from the empty ones of the new seat, so every row is read
  return withCharacter({ ...emptySeat(), inventory: cellsOfCharacter(c) }, c)
}

export const itemName = (c: ItemCell) => (c.item ? nameOf(byId.item[c.item]) || c.item : c.name || '')
