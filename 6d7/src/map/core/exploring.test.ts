import { describe, expect, it } from 'vitest'
import { ExploredMask } from './explored'
import { doorSeen, playerSight, playersSee, trackExplored, underFog } from './exploring'
import { createScene } from './scene'
import { MapStore } from './store'
import type { MapScene, Pin, RuleOverrides } from './types'

const cell = (u: number, v: number): Pin => ({ space: 'grid', u, v })
const at = (m: ExploredMask, x: number, y: number) => m.data[Math.floor(y * (m.h / m.image.height)) * m.w + Math.floor(x * (m.w / m.image.width))]

// three rooms in a row, 300 px each (cells of 100 px), walls between them; the map is under fog,
// the hero stands in the first room
function rooms(): MapScene {
  return {
    ...createScene('Подземелье'),
    image: { id: 'img', width: 900, height: 300, tileSize: 512, levels: 1 },
    walls: [
      { id: 'w1', kind: 'wall', a: cell(3, 0), b: cell(3, 3) },
      { id: 'w2', kind: 'wall', a: cell(6, 0), b: cell(6, 3) }
    ],
    tokens: [{ id: 'p1', kind: 'player', name: 'Арина', pin: cell(1.5, 1.5) }],
    fog: [{ id: 'f0', mode: 'cover' }]
  }
}

function track(scene = rooms(), campaign: RuleOverrides = {}) {
  const store = new MapStore(scene)
  const mask = new ExploredMask(scene.image!)
  const tracker = trackExplored(store, mask, () => campaign)
  const move = (u: number) => store.dispatch({ type: 'token.update', id: 'p1', patch: { pin: cell(u, 1.5) } })
  return { store, mask, tracker, move }
}

describe('trackExplored', () => {
  it('reveals what the hero sees at once, then after every move — nothing waits for a frame', () => {
    const { mask, move } = track()
    expect(at(mask, 150, 150)).toBe(255)
    expect(at(mask, 450, 150)).toBe(0)
    // through the second room into the third, quicker than a frame: the second room stays seen
    move(4.5)
    move(7.5)
    expect([at(mask, 150, 150), at(mask, 450, 150), at(mask, 750, 150)]).toEqual([255, 255, 255])
  })

  it('closes under new fog, everything under «cover», and forgets on a map without fog', () => {
    const { store, mask, move } = track()
    move(4.5)
    move(7.5)
    store.dispatch({ type: 'fog.add', stroke: { id: 'f1', mode: 'paint', radius: 60, points: [150, 150] } })
    expect(at(mask, 150, 150)).toBe(0)
    expect(at(mask, 450, 150)).toBe(255)
    // what the hero sees now opens again at once
    store.dispatch({ type: 'fog.add', stroke: { id: 'f2', mode: 'cover' } })
    expect([at(mask, 150, 150), at(mask, 450, 150), at(mask, 750, 150)]).toEqual([0, 0, 255])
    store.dispatch({ type: 'fog.clear' })
    expect(mask.empty).toBe(true)
  })

  it('reveals nothing with dynamic fog, and again when the campaign switches it off', () => {
    const campaign: RuleOverrides = { dynamicFog: true }
    const { mask, tracker } = track(rooms(), campaign)
    expect(mask.empty).toBe(true)
    campaign.dynamicFog = false
    tracker.update()
    expect(at(mask, 150, 150)).toBe(255)
  })

  it('stops with the owner and leaves a mask of another picture alone', () => {
    const { store, mask, tracker, move } = track()
    store.dispatch({ type: 'image', image: { id: 'img2', width: 600, height: 600, tileSize: 512, levels: 1 } })
    move(4.5)
    expect(at(mask, 450, 150)).toBe(0)
    tracker.stop()
    store.dispatch({ type: 'image', image: rooms().image })
    move(7.5)
    expect(at(mask, 750, 150)).toBe(0)
  })
})

describe('what players see', () => {
  it('lies where no fog is: strokes in order, an erasing one takes the fog off', () => {
    const p = { x: 100, y: 100 }
    expect(underFog([], p)).toBe(false)
    expect(underFog([{ id: 'a', mode: 'paint', radius: 50, points: [100, 100] }], p)).toBe(true)
    expect(underFog([{ id: 'a', mode: 'paint', radius: 50, points: [300, 100] }], p)).toBe(false)
    expect(underFog([{ id: 'a', mode: 'cover' }, { id: 'b', mode: 'erase', radius: 50, points: [80, 100, 120, 100] }], p)).toBe(false)
  })

  it('is what the tokens see now and, with static fog, what they have seen', () => {
    const scene = rooms()
    const mask = new ExploredMask(scene.image!)
    expect(playersSee(scene, { x: 150, y: 150 }, mask)).toBe(true)
    expect(playersSee(scene, { x: 450, y: 150 }, mask)).toBe(false)
    mask.reveal([[300, 0, 600, 0, 600, 300, 300, 300]])
    expect(playersSee(scene, { x: 450, y: 150 }, mask)).toBe(true)
    expect(playersSee(scene, { x: 450, y: 150 }, mask, { dynamicFog: true })).toBe(false)
  })

  it('finds a door by the floor on either side of it', () => {
    // a door in the first wall: the hero sees its left side
    const scene = { ...rooms(), doors: [{ id: 'd', wallId: 'w1', a: cell(3, 1), b: cell(3, 2), open: false }] }
    expect(doorSeen(scene, scene.doors[0], null)).toBe(true)
    const far = { ...scene, doors: [{ id: 'd2', wallId: 'w2', a: cell(6, 1), b: cell(6, 2), open: false }] }
    expect(doorSeen(far, far.doors[0], null)).toBe(false)
  })
})

describe('playerSight', () => {
  it('is computed once for the same tokens and walls', () => {
    const scene = rooms()
    const first = playerSight(scene)
    expect(first).toHaveLength(1)
    expect(playerSight({ ...scene, drawings: [] })).toBe(first)
    expect(playerSight({ ...scene, walls: [] })).not.toBe(first)
  })
})
