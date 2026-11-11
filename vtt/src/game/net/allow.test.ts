import { describe, expect, it } from 'vitest'
import { createScene } from '../../map/core/scene'
import type { MapScene, Token } from '../../map/core/types'
import { allowPlayerOp } from './allow'

const at = (u: number, v: number) => ({ space: 'grid' as const, u, v })
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
  })

  it('draws own lines and erases any but the master\'s; nothing else', () => {
    const s = scene()
    expect(allowPlayerOp(s, settings, 'p1', { type: 'draw.add', drawing: { id: 'y', author: 'p1', color: 'red', points: [1, 1] } })).toBe(true)
    expect(allowPlayerOp(s, settings, 'p1', { type: 'draw.add', drawing: { id: 'y', author: 'master', color: 'master', points: [1, 1] } })).toBe(false)
    expect(allowPlayerOp(s, settings, 'p1', { type: 'draw.remove', ids: ['x'] })).toBe(true)
    expect(allowPlayerOp(s, settings, 'p1', { type: 'draw.remove', ids: ['x', 'm'] })).toBe(false)
    expect(allowPlayerOp(s, settings, 'p1', { type: 'fog.clear' })).toBe(false)
    expect(allowPlayerOp(s, settings, 'p1', { type: 'token.remove', id: 'p1' })).toBe(false)
  })
})
