import { describe, expect, it } from 'vitest'
import { ExploredMask } from '../map/core/explored'
import { createScene } from '../map/core/scene'
import type { MapScene, Token } from '../map/core/types'
import { mergeGameMap, mergeScene, placePlayers } from './game'

const npc = (id: string, u: number, v: number, name = id): Token => ({ id, kind: 'npc', name, pin: { space: 'grid', u, v } })
const image = { id: 'img', width: 1000, height: 1000, tileSize: 512, levels: 1 }

function base(): MapScene {
  return {
    ...createScene('Склеп'),
    image,
    tokens: [npc('a', 1.5, 1.5), npc('b', 2.5, 2.5), npc('c', 3.5, 3.5)],
    doors: [{ id: 'd', wallId: 'w', a: { space: 'grid', u: 0, v: 0 }, b: { space: 'grid', u: 1, v: 0 }, open: false }]
  }
}

describe('mergeScene', () => {
  it('takes the editor version of what the editor changed, the game version of the rest', () => {
    const b = base()
    // the game moved a and b, removed c, added a player
    const game: MapScene = { ...b, tokens: [npc('a', 5.5, 5.5), npc('b', 6.5, 6.5), { id: 'p', kind: 'player', name: 'Арина', pin: { space: 'grid', u: 0.5, v: 0.5 } }] }
    // the editor moved b, deleted a, added e
    const editor: MapScene = { ...b, tokens: [npc('b', 9.5, 9.5), npc('c', 3.5, 3.5), npc('e', 4.5, 4.5)] }
    const merged = mergeScene(b, editor, game)
    const where = Object.fromEntries(merged.tokens.map((t) => [t.id, t.pin.space === 'grid' ? t.pin.u : null]))
    expect(where).toEqual({ b: 9.5, p: 0.5, e: 4.5 })
  })

  it('keeps open doors and conditions of the game unless the editor changed them', () => {
    const b = base()
    const game: MapScene = { ...b, doors: b.doors.map((d) => ({ ...d, open: true })), rules: { darkness: true, freeMove: false } }
    const editor: MapScene = { ...b, rules: { freeMove: true } }
    const merged = mergeScene(b, editor, game)
    expect(merged.doors[0].open).toBe(true)
    expect(merged.rules).toEqual({ darkness: true, freeMove: true })
    const moved: MapScene = { ...b, doors: b.doors.map((d) => ({ ...d, b: { space: 'grid' as const, u: 0, v: 1 } })) }
    expect(mergeScene(b, moved, game).doors[0].open).toBe(false)
  })

  it('puts the editor\'s new fog after the fog of the game', () => {
    const b: MapScene = { ...base(), fog: [{ id: 'f1', mode: 'cover' }] }
    const game: MapScene = { ...b, fog: [...b.fog, { id: 'g1', mode: 'erase', radius: 10, points: [0, 0] }] }
    const editor: MapScene = { ...b, fog: [...b.fog, { id: 'e1', mode: 'paint', radius: 10, points: [5, 5] }] }
    expect(mergeScene(b, editor, game).fog.map((s) => s.id)).toEqual(['f1', 'g1', 'e1'])
  })
})

describe('mergeGameMap', () => {
  it('closes explored places under the editor\'s new fog', () => {
    const b = base()
    const mask = new ExploredMask(image)
    mask.reveal([[0, 0, 1000, 0, 1000, 1000, 0, 1000]])
    const editor: MapScene = { ...b, fog: [{ id: 'e1', mode: 'paint', radius: 100, points: [500, 500] }] }
    const { map, explored } = mergeGameMap(editor, { schema: 1, scene: b, base: b }, mask.save())
    expect(map.base).toBe(editor)
    const after = new ExploredMask(image, explored)
    expect(after.data[256 * after.w + 256]).toBe(0)
    expect(after.data[10 * after.w + 10]).toBe(255)
  })

  it('drops what was explored when the picture changed its proportions', () => {
    const b = base()
    const mask = new ExploredMask(image)
    mask.reveal([[0, 0, 500, 0, 500, 500, 0, 500]])
    const editor: MapScene = { ...b, image: { ...image, id: 'img2', width: 2000 } }
    expect(mergeGameMap(editor, { schema: 1, scene: b, base: b }, mask.save()).explored).toBeNull()
  })

  it('starts a map the game has not played from the editor', () => {
    const b = base()
    expect(mergeGameMap(b, undefined, undefined)).toEqual({ map: { schema: 1, scene: b, base: b }, explored: null })
  })
})

describe('placePlayers', () => {
  const heroes = ['p1', 'p2', 'p3'].map((id): Omit<Token, 'pin'> => ({ id, kind: 'player', name: id }))

  it('puts the heroes on the spawn point and the nearest cells, past NPCs and walls', () => {
    const b: MapScene = {
      ...base(),
      tokens: [npc('n', 6.5, 5.5), { id: 'old', kind: 'player', name: 'x', pin: { space: 'grid', u: 0.5, v: 0.5 } }],
      spawn: { space: 'grid', u: 5.5, v: 5.5 },
      // a wall right of the spawn cell
      walls: [{ id: 'w', kind: 'wall', a: { space: 'grid', u: 6, v: 0 }, b: { space: 'grid', u: 6, v: 20 } }]
    }
    const ops = placePlayers(b, heroes)
    expect(ops[0]).toEqual({ type: 'token.remove', id: 'old' })
    const placed = ops.filter((o) => o.type === 'token.add').map((o) => (o.type === 'token.add' && o.token.pin.space === 'grid' ? [o.token.pin.u, o.token.pin.v] : null))
    expect(placed[0]).toEqual([5.5, 5.5])
    expect(placed).toHaveLength(3)
    for (const p of placed) expect(p![0]).toBeLessThan(6)
  })

  it('only takes the players off a map without a spawn point', () => {
    const b: MapScene = { ...base(), tokens: [{ id: 'old', kind: 'player', name: 'x', pin: { space: 'grid', u: 0.5, v: 0.5 } }] }
    expect(placePlayers(b, heroes)).toEqual([{ type: 'token.remove', id: 'old' }])
  })
})
