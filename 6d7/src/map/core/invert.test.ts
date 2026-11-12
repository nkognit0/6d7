import { describe, expect, it } from 'vitest'
import { invertMapOp } from './invert'
import { applyOp, createScene, rulesOf } from './scene'
import type { MapOp, MapScene } from './types'

const node = (u: number, v: number) => ({ space: 'grid' as const, u, v })
// lists whose order does not matter to the map
const norm = (s: MapScene) => {
  const byId = <T extends { id: string }>(l: T[]) => [...l].sort((a, b) => a.id.localeCompare(b.id))
  return { ...s, walls: byId(s.walls), doors: byId(s.doors), tokens: byId(s.tokens), drawings: byId(s.drawings) }
}

function base(): MapScene {
  return {
    ...createScene('Подземелье'),
    walls: [{ id: 'w1', kind: 'wall', a: node(0, 0), b: node(4, 0) }, { id: 'w2', kind: 'barrier', a: node(0, 0), b: node(0, 4) }],
    doors: [{ id: 'd1', wallId: 'w1', a: node(1, 0), b: node(2, 0), open: false }],
    spawn: node(1.5, 1.5),
    tokens: [{ id: 't1', kind: 'npc', pin: node(2.5, 2.5), name: 'Гоблин' }],
    drawings: [{ id: 'p1', author: 'master', color: 'master', points: [0, 0, 10, 10] }],
    fog: [{ id: 'f1', mode: 'cover' }, { id: 'f2', mode: 'erase', radius: 50, points: [100, 100] }]
  }
}

const OPS: MapOp[] = [
  { type: 'name', name: 'Склеп' },
  { type: 'image', image: { id: 'img', width: 1000, height: 800, tileSize: 512, levels: 2 } },
  { type: 'grid', patch: { size: 3.5, offsetX: 12 } },
  { type: 'rules', patch: { darkness: true, freeMove: false } },
  { type: 'rules', patch: { freeMove: null } },
  { type: 'wall.add', wall: { id: 'w3', kind: 'wall', a: node(4, 0), b: node(4, 4) } },
  { type: 'door.add', door: { id: 'd2', wallId: 'w2', a: node(0, 1), b: node(0, 2), open: false } },
  { type: 'door.open', id: 'd1', open: true },
  { type: 'spawn', pin: null },
  { type: 'build.remove', ids: ['w1'] },
  { type: 'token.add', token: { id: 't2', kind: 'player', pin: node(1.5, 1.5), name: 'Арина', color: 'red' } },
  { type: 'token.add', token: { id: 't1', kind: 'npc', pin: node(3.5, 3.5), name: 'Хобгоблин' } },
  { type: 'token.update', id: 't1', patch: { pin: node(0.5, 0.5), name: 'Вождь' } },
  { type: 'token.remove', id: 't1' },
  { type: 'draw.add', drawing: { id: 'p2', author: 'red', color: 'red', points: [1, 2, 3, 4] } },
  { type: 'draw.remove', ids: ['p1'] },
  { type: 'fog.add', stroke: { id: 'f3', mode: 'paint', radius: 20, points: [5, 5, 50, 50] } },
  { type: 'fog.add', stroke: { id: 'f4', mode: 'cover' } },
  { type: 'fog.remove', ids: ['f1'] },
  { type: 'fog.clear' }
]

describe('invertMapOp', () => {
  for (const op of OPS) {
    it(`takes back ${op.type}`, () => {
      const before = base()
      const after = applyOp(before, op)
      const back = invertMapOp(before, op).reduce(applyOp, after)
      expect(norm(back)).toEqual(norm(before))
    })
  }

  it('undoes a whole series in reverse order', () => {
    const start = base()
    let s = start
    const backs: MapOp[][] = []
    for (const op of OPS) {
      backs.push(invertMapOp(s, op))
      s = applyOp(s, op)
    }
    for (const back of backs.reverse()) s = back.reduce(applyOp, s)
    expect(norm(s)).toEqual(norm(start))
  })
})

describe('rulesOf', () => {
  it('takes the campaign where the map changed nothing', () => {
    expect(rulesOf({ rules: {} }, { freeMove: false, dynamicFog: true })).toMatchObject({ freeMove: false, dynamicFog: true, darkness: false })
  })
  it('lets the map override the campaign', () => {
    expect(rulesOf({ rules: { dynamicFog: false, darkness: true } }, { dynamicFog: true })).toMatchObject({ dynamicFog: false, darkness: true })
  })
  it('opens doors freely only while tokens move freely', () => {
    expect(rulesOf({ rules: { freeMove: false } }, { freeDoors: true }).freeDoors).toBe(false)
    expect(rulesOf({ rules: {} }, { freeDoors: true }).freeDoors).toBe(true)
  })
  it('drops an override with null', () => {
    const s = applyOp(applyOp(createScene(), { type: 'rules', patch: { freeMove: false } }), { type: 'rules', patch: { freeMove: null } })
    expect(s.rules).toEqual({})
  })
})
