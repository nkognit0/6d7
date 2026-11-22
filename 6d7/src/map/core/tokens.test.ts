import { describe, expect, it } from 'vitest'
import { createScene } from './scene'
import { placeTaken, snapTokenCenter, tokenCenter, tokenPinAt, tokenSize } from './tokens'
import type { MapScene, Pin, Token } from './types'

// cells of 100 px (grid size 2)
const cell = (u: number, v: number): Pin => ({ space: 'grid', u, v })
const npc = (id: string, pin: Pin, size?: number): Token => ({ id, kind: 'npc', name: id, pin, ...(size ? { size } : {}) })

function scene(tokens: Token[]): MapScene {
  return { ...createScene(), image: { id: 'img', width: 1000, height: 1000, tileSize: 512, levels: 1 }, tokens }
}

describe('tokens', () => {
  it('an NPC is 1–4 cells, a player one', () => {
    expect(tokenSize({ kind: 'npc' })).toBe(1)
    expect(tokenSize({ kind: 'npc', size: 3 })).toBe(3)
    expect(tokenSize({ kind: 'npc', size: 9 })).toBe(4)
    expect(tokenSize({ kind: 'npc', size: 0 })).toBe(1)
    expect(tokenSize({ kind: 'player', size: 3 })).toBe(1)
  })

  it('a big token is pinned by its top left cell and centered on its square', () => {
    const grid = createScene().grid
    expect(tokenCenter(npc('a', cell(1.5, 1.5)), grid)).toEqual({ x: 150, y: 150 })
    expect(tokenCenter(npc('a', cell(1.5, 1.5), 2), grid)).toEqual({ x: 200, y: 200 })
    expect(tokenCenter(npc('a', cell(1.5, 1.5), 3), grid)).toEqual({ x: 250, y: 250 })
    // a 2×2 token under the pointer at 230, 260 stands on cells 1–2 and 2–3
    const center = snapTokenCenter({ x: 230, y: 260 }, 2, grid)
    expect(center).toEqual({ x: 200, y: 300 })
    expect(tokenPinAt(center, 2, grid)).toEqual(cell(1.5, 2.5))
    expect(snapTokenCenter({ x: 230, y: 260 }, 1, grid)).toEqual({ x: 250, y: 250 })
  })

  it('a token takes its cells: neighbours may touch, not stand on it', () => {
    const s = scene([npc('ogre', cell(1.5, 1.5), 2)])
    // the ogre takes cells 1–2 × 1–2 (100–300 px)
    expect(placeTaken(s, { x: 250, y: 250 }, 1)).toBe(true)
    expect(placeTaken(s, { x: 350, y: 250 }, 1)).toBe(false)
    expect(placeTaken(s, { x: 50, y: 50 }, 1)).toBe(false)
    // a 2×2 one to the right touches it, one cell to the left of that stands on it
    expect(placeTaken(s, { x: 400, y: 200 }, 2)).toBe(false)
    expect(placeTaken(s, { x: 300, y: 200 }, 2)).toBe(true)
    // the token itself may move onto its own cells
    expect(placeTaken(s, { x: 300, y: 200 }, 2, 'ogre')).toBe(false)
  })
})
