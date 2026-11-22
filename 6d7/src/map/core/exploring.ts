// What players see and have seen, kept up with the map as it changes — not as it is drawn: a tab
// in the background (the master's, which keeps the game) explores as much as one on the screen.
// Plain data, no browser: the server will run the same code.
import type { ExploredMask } from './explored'
import { cellPx, distToPolyline, pinToImage } from './geometry'
import { rulesOf } from './scene'
import { tokenCenter } from './tokens'
import type { MapStore } from './store'
import type { Door, FogStroke, MapScene, RuleOverrides, Vec } from './types'
import { sightBlockers, visibilityPolygon, visionRadius } from './visibility'

// the sight of a map as computed last, by its tokens: the tracker and the renderer ask for the same scene
const kept = new WeakMap<MapScene['tokens'], { scene: MapScene; polys: number[][] }>()

// what the sight depends on besides the tokens (darkness is a rule of the map, not of the campaign)
const sameSight = (a: MapScene, b: MapScene) =>
  a.walls === b.walls && a.doors === b.doors && a.grid === b.grid && a.image === b.image && a.rules === b.rules

/** What the player tokens see now: polygons (x, y pairs in picture pixels); none without a picture. */
export function playerSight(scene: MapScene): number[][] {
  if (!scene.image) return []
  const last = kept.get(scene.tokens)
  if (last && sameSight(last.scene, scene)) return last.polys
  const blockers = sightBlockers(scene)
  const bounds = { x: 0, y: 0, w: scene.image.width, h: scene.image.height }
  const polys: number[][] = []
  for (const t of scene.tokens) {
    if (t.kind !== 'player') continue
    const p = tokenCenter(t, scene.grid)
    const poly = visibilityPolygon(p.x, p.y, blockers, visionRadius(t, scene), bounds)
    if (poly.length >= 6) polys.push(poly)
  }
  kept.set(scene.tokens, { scene, polys })
  return polys
}

// even-odd: the point inside a polygon of x, y pairs
function inside(poly: number[], x: number, y: number): boolean {
  let any = false
  for (let i = 0, j = poly.length - 2; i < poly.length; j = i, i += 2) {
    const [xi, yi, xj, yj] = [poly[i], poly[i + 1], poly[j], poly[j + 1]]
    if (yi > y !== yj > y && x < xi + ((y - yi) / (yj - yi)) * (xj - xi)) any = !any
  }
  return any
}

/** Whether the master's fog covers a point: the strokes in order, an erasing one takes it off. */
export function underFog(fog: FogStroke[], p: Vec): boolean {
  let covered = false
  for (const s of fog) {
    if (s.mode === 'cover') covered = true
    else if (distToPolyline(p, s.points) <= s.radius) covered = s.mode === 'paint'
  }
  return covered
}

/**
 * Whether players see a point of the map (picture pixels): where no fog lies, inside what their
 * tokens see now and, with static fog, what they have seen (`explored`). What the fog hides, a
 * player can neither point at nor reach from the interface.
 */
export function playersSee(scene: MapScene, p: Vec, explored: ExploredMask | null | undefined, campaign?: RuleOverrides): boolean {
  if (!underFog(scene.fog, p)) return true
  if (playerSight(scene).some((poly) => inside(poly, p.x, p.y))) return true
  return !rulesOf(scene, campaign).dynamicFog && !!explored && explored.seen(p.x, p.y)
}

/** Whether players see a door: the floor by its middle, on either side of the wall. */
export function doorSeen(scene: MapScene, door: Door, explored: ExploredMask | null | undefined, campaign?: RuleOverrides): boolean {
  const a = pinToImage(door.a, scene.grid)
  const b = pinToImage(door.b, scene.grid)
  const k = cellPx(scene.grid) / 4 / (Math.hypot(b.x - a.x, b.y - a.y) || 1)
  const m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
  const n = { x: -(b.y - a.y) * k, y: (b.x - a.x) * k }
  return [1, -1].some((s) => playersSee(scene, { x: m.x + s * n.x, y: m.y + s * n.y }, explored, campaign))
}

export interface ExploredTracker {
  /** Reveals what players see now again (the campaign's settings changed). */
  update(): void
  stop(): void
}

/**
 * Keeps `mask` up to date with the map of `store`, operation by operation: new fog closes what it
 * covers («cover» — everything), a map left without fog forgets what was seen, and with static fog
 * what the player tokens see is revealed after every change that moves them or what blocks their
 * view. `campaign` — the campaign's settings (dynamic fog may come from there). A map whose picture
 * no longer fits the mask is left alone: its owner makes a new mask.
 */
export function trackExplored(store: MapStore, mask: ExploredMask, campaign: () => RuleOverrides | undefined): ExploredTracker {
  const fits = (scene: MapScene) => scene.image?.width === mask.image.width && scene.image?.height === mask.image.height
  const reveal = (scene: MapScene) => {
    if (!fits(scene) || !scene.fog.length || rulesOf(scene, campaign()).dynamicFog) return
    mask.reveal(playerSight(scene))
  }
  reveal(store.get())
  const off = store.subscribe((scene, op, _source, prev) => {
    if (!fits(scene)) return
    if (op.type === 'fog.add') mask.hide(op.stroke)
    if (prev.fog !== scene.fog && !scene.fog.length) mask.clear()
    if (prev.fog !== scene.fog || prev.tokens !== scene.tokens || !sameSight(prev, scene)) reveal(scene)
  })
  return { update: () => reveal(store.get()), stop: off }
}
