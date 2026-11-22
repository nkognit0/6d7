// Where a token stands and what it takes: an NPC is 1×1 to 4×4 cells (QnA, 22.11.2026), a player
// token is always one cell. A token on the grid is pinned by its top left cell; one off the grid
// (no grid on the map) by its center. A token takes its square, and no other token may stand on
// it. Plain data, no browser: the server checks the same.
import { cellPin, cellPx, imagePin, pinToImage } from './geometry'
import type { GridSettings, MapScene, Pin, Token, Vec } from './types'

export const MAX_TOKEN_SIZE = 4

/** The side of the token in cells: 1–4 for an NPC, 1 for a player. */
export function tokenSize(t: Pick<Token, 'kind' | 'size'>): number {
  if (t.kind !== 'npc') return 1
  const n = Math.round(t.size ?? 1)
  return Number.isFinite(n) ? Math.max(1, Math.min(MAX_TOKEN_SIZE, n)) : 1
}

// from the center of the top left cell to the center of the token
const offset = (size: number, grid: GridSettings) => ((size - 1) / 2) * cellPx(grid)

/** The center of a token in picture pixels. */
export function tokenCenter(t: Pick<Token, 'kind' | 'size' | 'pin'>, grid: GridSettings): Vec {
  const p = pinToImage(t.pin, grid)
  if (t.pin.space !== 'grid') return p
  const d = offset(tokenSize(t), grid)
  return { x: p.x + d, y: p.y + d }
}

/** Where a token of this size lands under the point: on whole cells with the grid, at the point without it. */
export function snapTokenCenter(p: Vec, size: number, grid: GridSettings): Vec {
  if (!grid.enabled) return p
  const d = offset(size, grid)
  const at = pinToImage(cellPin({ x: p.x - d, y: p.y - d }, grid), grid)
  return { x: at.x + d, y: at.y + d }
}

/** The pin of a token of this size standing with its center at `center`. */
export function tokenPinAt(center: Vec, size: number, grid: GridSettings): Pin {
  if (!grid.enabled) return imagePin(center)
  const d = offset(size, grid)
  return cellPin({ x: center.x - d, y: center.y - d }, grid)
}

/**
 * Whether a token of `size` with its center at `center` would stand on another token (`except`:
 * the token being moved). Touching sides is not standing on.
 */
export function tokensAt(scene: MapScene, center: Vec, size: number, except?: string): Token[] {
  const c = cellPx(scene.grid)
  // a bit less than a pixel: neighbours on the grid touch exactly
  const eps = 0.5
  return scene.tokens.filter((t) => {
    if (t.id === except) return false
    const o = tokenCenter(t, scene.grid)
    const reach = ((tokenSize(t) + size) * c) / 2 - eps
    return Math.abs(o.x - center.x) < reach && Math.abs(o.y - center.y) < reach
  })
}

export const placeTaken = (scene: MapScene, center: Vec, size: number, except?: string) => tokensAt(scene, center, size, except).length > 0
