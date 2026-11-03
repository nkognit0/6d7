// Line of sight and movement through walls. Pure functions: the game server will run the same
// code to decide what each player may receive.
import { distToSegment, feetToPx, pinToImage, projectT } from './geometry'
import type { Door, MapScene, Token, Vec } from './types'

/** x1, y1, x2, y2 in pixels of the source image. */
export type Segment = [number, number, number, number]

/** The wall a–b without the pieces taken by the given doors. */
export function withoutDoors(a: Vec, b: Vec, doors: Door[], scene: MapScene): Segment[] {
  if (!doors.length) return [[a.x, a.y, b.x, b.y]]
  const cuts = doors
    .map((d) => {
      const t1 = projectT(pinToImage(d.a, scene.grid), a, b)
      const t2 = projectT(pinToImage(d.b, scene.grid), a, b)
      return [Math.min(t1, t2), Math.max(t1, t2)] as const
    })
    .sort((p, q) => p[0] - q[0])
  const at = (t: number) => [a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t] as const
  const out: Segment[] = []
  let t = 0
  for (const [c1, c2] of cuts) {
    if (c1 > t) out.push([...at(t), ...at(c1)])
    t = Math.max(t, c2)
  }
  if (t < 1) out.push([...at(t), ...at(1)])
  return out
}

/** What hides: walls and closed doors. Barriers and open doors let the eye through. */
export function sightBlockers(scene: MapScene): Segment[] {
  const out: Segment[] = []
  const kind = new Map(scene.walls.map((w) => [w.id, w.kind]))
  for (const w of scene.walls) {
    if (w.kind !== 'wall') continue
    const open = scene.doors.filter((d) => d.wallId === w.id && d.open)
    out.push(...withoutDoors(pinToImage(w.a, scene.grid), pinToImage(w.b, scene.grid), open, scene))
  }
  for (const d of scene.doors) {
    if (d.open || kind.get(d.wallId) !== 'barrier') continue
    const a = pinToImage(d.a, scene.grid)
    const b = pinToImage(d.b, scene.grid)
    out.push([a.x, a.y, b.x, b.y])
  }
  return out
}

/** What stops a token: walls, barriers and closed doors. */
export function moveBlockers(scene: MapScene): Segment[] {
  const out: Segment[] = []
  for (const w of scene.walls) {
    const open = scene.doors.filter((d) => d.wallId === w.id && d.open)
    out.push(...withoutDoors(pinToImage(w.a, scene.grid), pinToImage(w.b, scene.grid), open, scene))
  }
  return out
}

// side of (px, py) from the line a→b: 1, -1, or 0 on the line (with a tolerance for rounding)
function side(ax: number, ay: number, bx: number, by: number, px: number, py: number): number {
  const cross = (bx - ax) * (py - ay) - (by - ay) * (px - ax)
  const scale = Math.hypot(bx - ax, by - ay) * Math.hypot(px - ax, py - ay)
  return Math.abs(cross) <= scale * 1e-9 ? 0 : Math.sign(cross)
}

const NEAR = 1e-6
const same = (ax: number, ay: number, bx: number, by: number) => Math.abs(ax - bx) < NEAR && Math.abs(ay - by) < NEAR
const inBox = (x1: number, y1: number, x2: number, y2: number, x: number, y: number) =>
  Math.min(x1, x2) - NEAR <= x && x <= Math.max(x1, x2) + NEAR && Math.min(y1, y2) - NEAR <= y && y <= Math.max(y1, y2) + NEAR

// the path goes through the point p where it only touches blockers: it squeezes through only if
// blockers leave p on both sides of the path (two walls meeting at a corner); grazing the outside
// of a corner or the end of a lone wall is fine
function squeezes(p: Vec, a: Vec, b: Vec, blockers: Segment[]): boolean {
  let left = false
  let right = false
  for (const s of blockers) {
    const ends: [number, number][] = []
    if (same(s[0], s[1], p.x, p.y)) ends.push([s[2], s[3]])
    else if (same(s[2], s[3], p.x, p.y)) ends.push([s[0], s[1]])
    else if (side(s[0], s[1], s[2], s[3], p.x, p.y) === 0 && inBox(s[0], s[1], s[2], s[3], p.x, p.y)) ends.push([s[0], s[1]], [s[2], s[3]])
    for (const [x, y] of ends) {
      const k = side(a.x, a.y, b.x, b.y, x, y)
      if (k > 0) left = true
      if (k < 0) right = true
    }
  }
  return left && right
}

/**
 * The straight path a–b goes through a blocker. Passing a corner diagonally is allowed as long
 * as the path does not slip between two walls meeting there; a target on a wall is blocked.
 */
export function pathBlocked(a: Vec, b: Vec, blockers: Segment[]): boolean {
  if (same(a.x, a.y, b.x, b.y)) return false
  const touches: Vec[] = []
  for (const s of blockers) {
    const o1 = side(a.x, a.y, b.x, b.y, s[0], s[1])
    const o2 = side(a.x, a.y, b.x, b.y, s[2], s[3])
    // along the line of a wall: the path does not cross it
    if (o1 === 0 && o2 === 0) continue
    const o3 = side(s[0], s[1], s[2], s[3], a.x, a.y)
    const o4 = side(s[0], s[1], s[2], s[3], b.x, b.y)
    if (o1 * o2 < 0 && o3 * o4 < 0) return true
    if (o4 === 0 && inBox(s[0], s[1], s[2], s[3], b.x, b.y)) return true
    if (o1 === 0 && inBox(a.x, a.y, b.x, b.y, s[0], s[1])) touches.push({ x: s[0], y: s[1] })
    if (o2 === 0 && inBox(a.x, a.y, b.x, b.y, s[2], s[3])) touches.push({ x: s[2], y: s[3] })
  }
  return touches.some((p) => squeezes(p, a, b, blockers))
}

/**
 * How far a token sees inside fog, in image pixels: unlimited in the light; in darkness only
 * darkvision or an equipped light (0 — nothing).
 */
export function visionRadius(token: Token, scene: MapScene): number {
  if (!scene.rules.darkness) return Infinity
  return feetToPx(Math.max(token.darkvision ?? 0, token.light ?? 0), scene.grid)
}

// distance along the ray o + t·d to the segment, Infinity if it misses
function raySegment(ox: number, oy: number, dx: number, dy: number, s: Segment): number {
  const sx = s[2] - s[0]
  const sy = s[3] - s[1]
  const den = dx * sy - dy * sx
  if (Math.abs(den) < 1e-12) return Infinity
  const qx = s[0] - ox
  const qy = s[1] - oy
  const t = (qx * sy - qy * sx) / den
  const u = (qx * dy - qy * dx) / den
  return t > 1e-9 && u >= -1e-9 && u <= 1 + 1e-9 ? t : Infinity
}

const CIRCLE_SIDES = 48

/**
 * The area seen from (ox, oy): a polygon as x, y pairs. Rays go to every blocker end (and
 * just past it); a finite radius is a 48-gon of extra blockers around the eye, so the polygon
 * is already cut by the circle. `bounds` closes the view in the light.
 */
export function visibilityPolygon(
  ox: number, oy: number, blockers: Segment[], radius: number,
  bounds: { x: number; y: number; w: number; h: number }
): number[] {
  if (radius <= 0) return []
  const segs: Segment[] = []
  if (Number.isFinite(radius)) {
    // circumscribed polygon: the true circle lies inside it
    const r = radius / Math.cos(Math.PI / CIRCLE_SIDES)
    for (let i = 0; i < CIRCLE_SIDES; i++) {
      const a1 = (i / CIRCLE_SIDES) * Math.PI * 2
      const a2 = ((i + 1) / CIRCLE_SIDES) * Math.PI * 2
      segs.push([ox + Math.cos(a1) * r, oy + Math.sin(a1) * r, ox + Math.cos(a2) * r, oy + Math.sin(a2) * r])
    }
    const minX = ox - r, maxX = ox + r, minY = oy - r, maxY = oy + r
    for (const s of blockers) {
      if (Math.max(s[0], s[2]) < minX || Math.min(s[0], s[2]) > maxX || Math.max(s[1], s[3]) < minY || Math.min(s[1], s[3]) > maxY) continue
      segs.push(s)
    }
  } else {
    const x1 = Math.min(bounds.x, ox) - 1, y1 = Math.min(bounds.y, oy) - 1
    const x2 = Math.max(bounds.x + bounds.w, ox) + 1, y2 = Math.max(bounds.y + bounds.h, oy) + 1
    segs.push([x1, y1, x2, y1], [x2, y1, x2, y2], [x2, y2, x1, y2], [x1, y2, x1, y1], ...blockers)
  }

  const angles: number[] = []
  const EPS = 1e-4
  for (const s of segs) {
    const a1 = Math.atan2(s[1] - oy, s[0] - ox)
    const a2 = Math.atan2(s[3] - oy, s[2] - ox)
    angles.push(a1 - EPS, a1, a1 + EPS, a2 - EPS, a2, a2 + EPS)
  }
  angles.sort((p, q) => p - q)

  // nearest blockers first: a ray stops checking once the rest are farther than its hit
  const o = { x: ox, y: oy }
  const near = segs.map((s) => distToSegment(o, { x: s[0], y: s[1] }, { x: s[2], y: s[3] }))
  const order = segs.map((_, i) => i).sort((p, q) => near[p] - near[q])

  const hits: number[] = []
  const hitSeg: number[] = []
  let prev = NaN
  for (const a of angles) {
    if (a === prev) continue
    prev = a
    const dx = Math.cos(a)
    const dy = Math.sin(a)
    let best = Infinity
    let seg = -1
    for (const i of order) {
      if (near[i] >= best) break
      const t = raySegment(ox, oy, dx, dy, segs[i])
      if (t < best) [best, seg] = [t, i]
    }
    if (seg >= 0) {
      hits.push(ox + dx * best, oy + dy * best)
      hitSeg.push(seg)
    }
  }
  // points in the middle of a run on the same segment add nothing: drop them (fewer triangles)
  const n = hitSeg.length
  const out: number[] = []
  for (let i = 0; i < n; i++) {
    const s = hitSeg[i]
    if (n > 3 && hitSeg[(i + n - 1) % n] === s && hitSeg[(i + 1) % n] === s) continue
    out.push(hits[i * 2], hits[i * 2 + 1])
  }
  return out
}
