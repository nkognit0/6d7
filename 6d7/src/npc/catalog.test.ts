import { describe, expect, it } from 'vitest'
import { matches, NPC_TOKENS, npcToken, searchTokens } from './catalog'

describe('NPC catalog', () => {
  it('has every token of the catalog with both names', () => {
    expect(NPC_TOKENS).toHaveLength(210)
    expect(new Set(NPC_TOKENS.map((t) => t.id)).size).toBe(210)
    expect(npcToken('npc-goblin-rare')).toMatchObject({ name: 'Гоблин', nameEn: 'Goblin', rarity: 'rare', rarityRu: 'редкий' })
    expect(npcToken('elf-high-elf-common')?.nameEn).toBe('Elf (High Elf)')
  })

  it('finds by kind and rarity in Russian and English', () => {
    const ids = (q: string) => searchTokens(q).map((t) => t.id)
    expect(ids('гоблин')).toEqual(['npc-goblin-common', 'npc-goblin-rare', 'npc-goblin-legendary'])
    expect(ids('goblin legendary')).toEqual(['npc-goblin-legendary'])
    expect(ids('Гоб ЛЕГЕНД')).toEqual(['npc-goblin-legendary'])
    expect(ids('высший')).toHaveLength(3)
    expect(ids('drow rare')).toEqual(['elf-drow-rare'])
    expect(searchTokens('')).toHaveLength(210)
    expect(ids('дракон')).toHaveLength(30)
  })

  it('reads «ё» as «е» and ignores punctuation', () => {
    expect(matches('зеленый', ['Драконорождённый (Зелёный дракон)'])).toBe(true)
    expect(matches('kuo toa', ['Kuo-toa'])).toBe(true)
    expect(matches('лин', ['Гоблин'])).toBe(false)
  })
})
