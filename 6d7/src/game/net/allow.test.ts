import { describe, expect, it } from 'vitest'
import { ExploredMask } from '../../map/core/explored'
import { createScene } from '../../map/core/scene'
import type { MapOp, MapScene, Token } from '../../map/core/types'
import { allowPlayerOp } from './allow'

const at = (u: number, v: number) => ({ space: 'grid' as const, u, v })
// ten cells by two, 100 px each
const image = { id: 'img', width: 1000, height: 200, tileSize: 512, levels: 1 }
const hero = (id: string, u: number): Token => ({ id, kind: 'player', name: id, pin: at(u, 0.5) })
const settings = { freeMove: true, freeDoors: true, dynamicFog: false }

function scene(): MapScene {
  return {
    ...createScene('Склеп'),
    tokens: [hero('p1', 0.5), hero('p2', 1.5), { id: 'n', kind: 'npc', name: 'Аболет', pin: at(2.5, 0.5) }],
    // a wall between the columns 3 and 4
    walls: [{ id: 'w', kind: 'wall', a: at(4, -5), b: at(4, 5) }],
    doors: [{ id: 'd', wallId: 'w', a: at(4, 0), b: at(4, 1), open: false }],
    drawings: [{ id: 'm', author: 'master', color: 'master', points: [0, 0, 10, 10] }, { id: 'x', author: 'p2', color: 'green', points: [0, 0, 5, 5] }]
  }
}

describe('allowPlayerOp', () => {
  it('lets a player move only own tokens, freely and not through walls', () => {
    const s = scene()
    expect(allowPlayerOp(s, settings, 'p1', { type: 'token.update', id: 'p1', patch: { pin: at(3.5, 0.5) } })).toBe(true)
    expect(allowPlayerOp(s, settings, 'p1', { type: 'token.update', id: 'p2', patch: { pin: at(3.5, 0.5) } })).toBe(false)
    expect(allowPlayerOp(s, settings, 'p1', { type: 'token.update', id: 'n', patch: { pin: at(3.5, 0.5) } })).toBe(false)
    expect(allowPlayerOp(s, settings, 'p1', { type: 'token.update', id: 'p1', patch: { pin: at(5.5, 0.5) } })).toBe(false)
    expect(allowPlayerOp(s, settings, 'p1', { type: 'token.update', id: 'p1', patch: { name: 'Другое' } })).toBe(false)
    expect(allowPlayerOp(s, { ...settings, freeMove: false }, 'p1', { type: 'token.update', id: 'p1', patch: { pin: at(3.5, 0.5) } })).toBe(false)
  })

  it('lets a player put own hero and companion on the map once', () => {
    const s = { ...scene(), tokens: [] }
    expect(allowPlayerOp(s, settings, 'p1', { type: 'token.add', token: hero('p1', 0.5) })).toBe(true)
    expect(allowPlayerOp(s, settings, 'p1', { type: 'token.add', token: { ...hero('p1:companion', 0.5), owner: 'p1' } })).toBe(true)
    expect(allowPlayerOp(s, settings, 'p1', { type: 'token.add', token: hero('p2', 0.5) })).toBe(false)
    expect(allowPlayerOp(scene(), settings, 'p1', { type: 'token.add', token: hero('p1', 0.5) })).toBe(false)
  })

  it('opens doors only when players open them themselves', () => {
    expect(allowPlayerOp(scene(), settings, 'p1', { type: 'door.open', id: 'd', open: true })).toBe(true)
    expect(allowPlayerOp(scene(), { ...settings, freeDoors: false }, 'p1', { type: 'door.open', id: 'd', open: true })).toBe(false)
    // players only open: closing, or opening an open door, is not theirs
    expect(allowPlayerOp(scene(), settings, 'p1', { type: 'door.open', id: 'd', open: false })).toBe(false)
    const open = { ...scene(), doors: [{ ...scene().doors[0], open: true }] }
    expect(allowPlayerOp(open, settings, 'p1', { type: 'door.open', id: 'd', open: true })).toBe(false)
  })

  it('under the fog: opens only doors and puts tokens only where players see', () => {
    // the whole map under fog; the hero p2 stands left of the wall (x = 400), the door is closed
    const fogged = (): MapScene => ({ ...scene(), image, tokens: [hero('p2', 1.5)], fog: [{ id: 'f', mode: 'cover' }] })
    const add = (u: number): MapOp => ({ type: 'token.add', token: hero('p1', u) })
    expect(allowPlayerOp(fogged(), settings, 'p1', add(2.5))).toBe(true)
    expect(allowPlayerOp(fogged(), settings, 'p1', add(6.5))).toBe(false)
    // what was seen before stays open with static fog, not with dynamic
    const explored = new ExploredMask(image)
    explored.reveal([[600, 0, 1000, 0, 1000, 200, 600, 200]])
    expect(allowPlayerOp(fogged(), settings, 'p1', add(6.5), { explored })).toBe(true)
    expect(allowPlayerOp(fogged(), { ...settings, dynamicFog: true }, 'p1', add(6.5), { explored })).toBe(false)
    // moving into the fog is how players explore: only walls stop it
    const walk = { ...fogged(), tokens: [hero('p1', 0.5)] }
    expect(allowPlayerOp(walk, settings, 'p1', { type: 'token.update', id: 'p1', patch: { pin: at(3.5, 1.5) } })).toBe(true)
    // the door is seen by p2; with nobody on the map nobody sees it
    expect(allowPlayerOp(fogged(), settings, 'p1', { type: 'door.open', id: 'd', open: true })).toBe(true)
    expect(allowPlayerOp({ ...fogged(), tokens: [] }, settings, 'p1', { type: 'door.open', id: 'd', open: true })).toBe(false)
  })

  it('takes a token only as the sheet makes it', () => {
    const s = { ...scene(), tokens: [] }
    const expected = (t: Token) => (t.owner ? null : { id: 'p1', kind: 'player' as const, name: 'Арина', color: 'red' as const, darkvision: 60 })
    const sheet = { ...hero('p1', 0.5), name: 'Арина', color: 'red' as const, darkvision: 60 }
    expect(allowPlayerOp(s, settings, 'p1', { type: 'token.add', token: sheet }, { expected })).toBe(true)
    expect(allowPlayerOp(s, settings, 'p1', { type: 'token.add', token: { ...sheet, darkvision: 300 } }, { expected })).toBe(false)
    expect(allowPlayerOp(s, settings, 'p1', { type: 'token.add', token: { ...sheet, light: 120 } }, { expected })).toBe(false)
    expect(allowPlayerOp(s, settings, 'p1', { type: 'token.add', token: { ...sheet, image: 'https://example.com/x.png' } }, { expected })).toBe(false)
    // no companion on the sheet: no companion token
    expect(allowPlayerOp(s, settings, 'p1', { type: 'token.add', token: { ...hero('p1:companion', 0.5), owner: 'p1' } }, { expected })).toBe(false)
  })

  it('draws own lines and erases any but the master\'s; nothing else', () => {
    const s = scene()
    expect(allowPlayerOp(s, settings, 'p1', { type: 'draw.add', drawing: { id: 'y', author: 'p1', color: 'red', points: [1, 1] } })).toBe(true)
    expect(allowPlayerOp(s, settings, 'p1', { type: 'draw.add', drawing: { id: 'y', author: 'master', color: 'master', points: [1, 1] } })).toBe(false)
    // in the player's color, a line of numbers
    const line = (color: 'red' | 'green', points: number[]): MapOp => ({ type: 'draw.add', drawing: { id: 'z', author: 'p1', color, points } })
    expect(allowPlayerOp(s, settings, 'p1', line('red', [1, 1, 5, 5]), { color: 'red' })).toBe(true)
    expect(allowPlayerOp(s, settings, 'p1', line('green', [1, 1, 5, 5]), { color: 'red' })).toBe(false)
    expect(allowPlayerOp(s, settings, 'p1', line('red', [1, 1, 5]), { color: 'red' })).toBe(false)
    expect(allowPlayerOp(s, settings, 'p1', line('red', [1, NaN]), { color: 'red' })).toBe(false)
    expect(allowPlayerOp(s, settings, 'p1', line('red', new Array(30000).fill(1)), { color: 'red' })).toBe(false)
    expect(allowPlayerOp(s, settings, 'p1', { type: 'draw.remove', ids: ['x'] })).toBe(true)
    expect(allowPlayerOp(s, settings, 'p1', { type: 'draw.remove', ids: ['x', 'm'] })).toBe(false)
    expect(allowPlayerOp(s, settings, 'p1', { type: 'fog.clear' })).toBe(false)
    expect(allowPlayerOp(s, settings, 'p1', { type: 'token.remove', id: 'p1' })).toBe(false)
  })
})
