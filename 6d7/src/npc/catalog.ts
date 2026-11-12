// The catalog of NPC tokens: 70 kinds × common, rare and legendary, from Too Many Tokens (MIT).
// The list and the Russian names live in the old app's token catalog (app/src/tokens/tokens.json),
// the pictures in app/public/tokens; the dev server serves them at /tokens/.
import tokens from '@app/tokens/tokens.json'
import type { SavedNpc } from '../campaign/types'
import { newId } from '../map/core/geometry'
import type { Token } from '../map/core/types'

export type Rarity = 'common' | 'rare' | 'legendary'

export interface NpcToken {
  /** file name without the extension: the id saved in campaigns */
  id: string
  url: string
  rarity: Rarity
  /** «Эльф (Высший эльф)» */
  name: string
  /** «Elf (High Elf)»: only for search */
  nameEn: string
  /** rarity in Russian as the catalog writes it: «простой», «редкий», «легендарный» */
  rarityRu: string
}

interface Entry {
  species: string | null
  option: string | null
  race: string | null
  subrace: string | null
  rarity: Rarity
  name_ru: string
  race_ru: string | null
  subrace_ru: string | null
  rarity_ru: string
  file: string
}

const title = (id: string) => id.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')

function englishName(e: Entry): string {
  const kind = e.race ?? e.species ?? ''
  const sub = e.race ? e.subrace : e.option
  return sub ? `${title(kind)} (${title(sub)})` : title(kind)
}

export const NPC_TOKENS: NpcToken[] = (tokens.tokens as unknown as Entry[]).map((e) => ({
  id: e.file.replace(/\.\w+$/, ''),
  url: `${import.meta.env.BASE_URL}tokens/${e.file}`,
  rarity: e.rarity,
  name: e.name_ru,
  nameEn: englishName(e),
  rarityRu: e.rarity_ru
}))

const byId = new Map(NPC_TOKENS.map((t) => [t.id, t]))
export const npcToken = (id: string): NpcToken | undefined => byId.get(id)

/** Lower case, «ё» as «е», punctuation as spaces. */
export function normalize(text: string): string {
  return text.toLowerCase().replace(/ё/g, 'е').replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
}

/** Every word of the query is the start of some word of the texts (in any order). */
export function matches(query: string, texts: (string | undefined)[]): boolean {
  const words = normalize(query).split(' ').filter(Boolean)
  if (!words.length) return true
  const hay = texts.filter(Boolean).map((t) => ` ${normalize(t!)}`).join(' ')
  return words.every((w) => hay.includes(` ${w}`))
}

/** What a token is found by: its kind and rarity in Russian and English (QnA, NPC). */
export const tokenTexts = (t: NpcToken): string[] => [t.name, t.nameEn, t.rarityRu, t.rarity]

export function searchTokens(query: string, list: NpcToken[] = NPC_TOKENS): NpcToken[] {
  return list.filter((t) => matches(query, tokenTexts(t)))
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/** The rarity of a catalog token as the panels write it: «Простой». */
export const rarityText = (tokenId: string) => cap(npcToken(tokenId)?.rarityRu ?? '')

/** A card of the NPC list of a panel and the token it puts on the map. */
export interface NpcCardData {
  key: string
  image: string
  name: string
  note: string
  token: () => Omit<Token, 'pin'>
}

/** The NPCs to drag onto a map: the catalog, or (catalog off) the master's saved NPCs. */
export function npcCards(saved: SavedNpc[], catalog: boolean, query: string): NpcCardData[] {
  if (catalog) {
    return searchTokens(query).map((c) => ({
      key: c.id, image: c.url, name: c.name, note: cap(c.rarityRu),
      token: () => ({ id: newId(), kind: 'npc', name: c.name, image: c.url, token: c.id })
    }))
  }
  return saved
    .filter((n) => {
      const c = npcToken(n.token)
      return matches(query, [...(c ? tokenTexts(c) : []), n.name, n.description])
    })
    .map((n) => ({
      key: n.id, image: npcToken(n.token)?.url ?? '', name: n.name, note: n.description.split('\n')[0] || rarityText(n.token),
      token: () => ({ id: newId(), kind: 'npc', name: n.name, image: npcToken(n.token)?.url, token: n.token, saved: n.id })
    }))
}
