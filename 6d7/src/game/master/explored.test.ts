import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createCampaign } from '../../campaign/campaign'
import { exploredKey, freshGameMap, GAME_KEY, gameMapKey } from '../../campaign/game'
import { CampaignSession, type SessionStorage } from '../../campaign/session'
import { createScene } from '../../map/core/scene'
import type { MapScene, Pin } from '../../map/core/types'
import { ExploredKeeper } from './explored'

const cell = (u: number, v: number): Pin => ({ space: 'grid', u, v })
const storage: SessionStorage = { append: async () => {}, compact: async () => {} }

// two rooms side by side under fog; the hero stands in the left one
function map(id: string): MapScene {
  return {
    ...createScene(id),
    id,
    image: { id: `img-${id}`, width: 600, height: 300, tileSize: 512, levels: 1 },
    walls: [{ id: 'w', kind: 'wall', a: cell(3, 0), b: cell(3, 3) }],
    tokens: [{ id: 'p1', kind: 'player', name: 'Арина', pin: cell(1.5, 1.5) }],
    fog: [{ id: 'f0', mode: 'cover' }]
  }
}

function game() {
  const m1 = map('m1')
  const m2 = map('m2')
  const session = new CampaignSession({ campaign: { ...createCampaign('Кампания', 'c1'), maps: ['m1', 'm2'] }, maps: { m1, m2 }, seats: {} }, storage)
  session.apply([
    { doc: gameMapKey('m1'), set: freshGameMap(m1) },
    { doc: gameMapKey('m2'), set: freshGameMap(m2) },
    { doc: GAME_KEY, set: { schema: 1, active: 'm1' } }
  ], { record: false })
  const keeper = new ExploredKeeper(session)
  const detach = keeper.attach()
  // the saved mask in the middle of a room: 255 — seen
  const room = (id: string, side: 'left' | 'right') => {
    const d = session.exploredOf(id)
    return d ? d.data[Math.floor(d.h / 2) * d.w + Math.floor((d.w * (side === 'left' ? 1 : 3)) / 4)] : 0
  }
  const right = (id: string) => room(id, 'right')
  const walk = () => session.gameMap('m1')!.store.dispatch({ type: 'token.update', id: 'p1', patch: { pin: cell(4.5, 1.5) } })
  return { session, keeper, detach, room, right, walk }
}

describe('ExploredKeeper', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('explores the map of the game with no field on the screen and saves in a pause', async () => {
    const { keeper, right, walk } = game()
    expect(keeper.of('m1')).not.toBeNull()
    expect(keeper.of('m2')).toBeNull()
    walk()
    expect(right('m1')).toBe(0)
    await vi.advanceTimersByTimeAsync(2500)
    expect(right('m1')).toBe(255)
  })

  it('writes what is not saved yet when the game goes to another map or the screen goes', () => {
    const { session, keeper, detach, right, walk } = game()
    walk()
    session.apply([{ doc: GAME_KEY, set: { schema: 1, active: 'm2' } }], { record: false })
    expect(right('m1')).toBe(255)
    expect(keeper.of('m2')).not.toBeNull()
    session.gameMap('m2')!.store.dispatch({ type: 'token.update', id: 'p1', patch: { pin: cell(4.5, 1.5) } })
    detach()
    expect(right('m2')).toBe(255)
  })

  it('takes a saved mask written by someone else (an import, a start) instead of its own', async () => {
    const { session, keeper, room, walk } = game()
    const live = keeper.of('m1')!
    walk()
    // an imported state where nobody has seen anything
    const imported = { w: live.w, h: live.h, data: new Uint8Array(live.w * live.h) }
    session.apply([{ doc: exploredKey('m1'), set: imported }], { record: false })
    expect(keeper.of('m1') === live).toBe(false)
    // the old mask's pending write (both rooms) does not come over it; what the hero sees now opens
    await vi.advanceTimersByTimeAsync(2500)
    expect(room('m1', 'left')).toBe(0)
    expect(room('m1', 'right')).toBe(255)
  })
})
