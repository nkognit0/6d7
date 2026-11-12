import { describe, expect, it } from 'vitest'
import { applyCampaignOp, createCampaign, FLOW_ORDER, freeColor, invertCampaignOp, newCode, newPlayer, normalizeCode, CODE_LENGTH } from './campaign'
import { History } from './history'
import type { Campaign, CampaignOp, Change } from './types'

function base(): Campaign {
  return {
    ...createCampaign('Проклятие Страда', 'c1'),
    players: [{ id: 'p1', name: 'Арина', color: 'red' }, { id: 'p2', name: 'Борис', color: 'orange' }],
    maps: ['m1', 'm2', 'm3'],
    npcs: [{ id: 'n1', token: 'npc-goblin-common', name: 'Гоблин', description: 'простой' }]
  }
}

const OPS: CampaignOp[] = [
  { type: 'rename', name: 'Новое имя' },
  { type: 'settings', patch: { freeMove: false, dynamicFog: true } },
  { type: 'player.add', player: { id: 'p3', name: 'Вера', color: 'yellow' }, index: 1 },
  { type: 'player.update', id: 'p1', patch: { name: 'Арина Сергеевна' } },
  { type: 'player.remove', id: 'p1' },
  { type: 'map.add', id: 'm4', index: 0 },
  { type: 'map.remove', id: 'm2' },
  { type: 'map.move', id: 'm3', index: 0 },
  { type: 'npc.put', npc: { id: 'n2', token: 'npc-orc-rare', name: 'Орк', description: '' } },
  { type: 'npc.put', npc: { id: 'n1', token: 'npc-goblin-common', name: 'Вождь', description: 'главный' } },
  { type: 'npc.remove', id: 'n1' }
]

describe('campaign operations', () => {
  for (const op of OPS) {
    it(`takes back ${op.type}`, () => {
      const before = base()
      const after = applyCampaignOp(before, op)
      expect(invertCampaignOp(before, op).reduce(applyCampaignOp, after)).toEqual(before)
    })
  }

  it('gives players the free colors in order', () => {
    const c = base()
    expect(freeColor(c)).toBe('yellow')
    const full = { ...c, players: FLOW_ORDER.map((color, i) => ({ id: `p${i}`, name: '', color })) }
    expect(freeColor(full)).toBeNull()
    expect(newPlayer(full)).toBeNull()
    expect(newPlayer(c)?.color).toBe('yellow')
  })
})

describe('codes', () => {
  it('are short, unique and without look-alike characters', () => {
    const taken = new Set<string>()
    for (let i = 0; i < 2000; i++) {
      const code = newCode((c) => taken.has(c))
      expect(code).toMatch(new RegExp(`^[A-HJKMNP-Z2-9]{${CODE_LENGTH}}$`))
      expect(taken.has(code)).toBe(false)
      taken.add(code)
    }
  })
  it('are read as typed', () => {
    expect(normalizeCode(' ab2-c3d4 ')).toBe('AB2C3D4')
  })
})

describe('History', () => {
  const ch = (name: string): Change => ({ doc: 'campaign', op: { type: 'rename', name } })

  it('joins quick edits of the same thing into one step', () => {
    const h = new History()
    h.record([ch('a')], [ch('')], 'rename', 0)
    h.record([ch('ab')], [ch('a')], 'rename', 500)
    h.record([ch('abc')], [ch('ab')], 'rename', 3000)
    const last = h.takeUndo()!
    expect(last.forward).toEqual([ch('abc')])
    const first = h.takeUndo()!
    expect(first.forward).toEqual([ch('a'), ch('ab')])
    expect(first.backward).toEqual([ch('a'), ch('')])
    expect(h.canUndo).toBe(false)
  })

  it('forgets what was undone after a new change', () => {
    const h = new History()
    h.record([ch('a')], [ch('')], null, 0)
    h.takeUndo()
    expect(h.canRedo).toBe(true)
    h.record([ch('b')], [ch('')], null, 10)
    expect(h.canRedo).toBe(false)
  })
})
