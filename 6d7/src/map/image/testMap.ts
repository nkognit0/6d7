// A procedural dungeon for checking speed and looks without a real map: rooms, corridors,
// walls and doors along cell edges. Runs in the worker (OffscreenCanvas). The colors are map
// art, not interface, so they are plain values.
import type { TestMapLayout } from './protocol'

function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

type Room = { u: number; v: number; w: number; h: number }
const ROCK = 0
const ROOM = 1
const HALL = 2

function plan(cols: number, rows: number, rand: () => number) {
  const ri = (a: number, b: number) => a + Math.floor(rand() * (b - a + 1))
  const cells = new Uint8Array(cols * rows)
  const at = (u: number, v: number) => (u < 0 || v < 0 || u >= cols || v >= rows ? ROCK : cells[v * cols + u])
  const set = (u: number, v: number, k: number) => {
    if (u >= 0 && v >= 0 && u < cols && v < rows) cells[v * cols + u] = k
  }

  const rooms: Room[] = []
  const target = Math.max(4, Math.floor((cols * rows) / 110))
  for (let tries = 0; tries < target * 30 && rooms.length < target; tries++) {
    const w = ri(4, 11)
    const h = ri(4, 10)
    const u = ri(1, cols - w - 2)
    const v = ri(1, rows - h - 2)
    if (rooms.some((r) => u < r.u + r.w + 2 && u + w + 2 > r.u && v < r.v + r.h + 2 && v + h + 2 > r.v)) continue
    rooms.push({ u, v, w, h })
  }
  for (const r of rooms) for (let v = r.v; v < r.v + r.h; v++) for (let u = r.u; u < r.u + r.w; u++) set(u, v, ROOM)

  // corridors: every room joins the nearest room that is already connected
  const center = (r: Room) => [r.u + (r.w >> 1), r.v + (r.h >> 1)] as const
  // an L-shaped corridor: across then down, or down then across
  const carve = (u1: number, v1: number, u2: number, v2: number) => {
    const dig = (u: number, v: number) => {
      if (at(u, v) === ROCK) set(u, v, HALL)
    }
    const across = (v: number) => {
      for (let u = Math.min(u1, u2); u <= Math.max(u1, u2); u++) dig(u, v)
    }
    const down = (u: number) => {
      for (let v = Math.min(v1, v2); v <= Math.max(v1, v2); v++) dig(u, v)
    }
    if (rand() < 0.5) {
      across(v1)
      down(u2)
    } else {
      down(u1)
      across(v2)
    }
  }
  const joined = [rooms[0]]
  for (const r of rooms.slice(1)) {
    const [u1, v1] = center(r)
    let best = joined[0]
    let bestD = Infinity
    for (const j of joined) {
      const [u2, v2] = center(j)
      const d = Math.abs(u1 - u2) + Math.abs(v1 - v2)
      if (d < bestD) [best, bestD] = [j, d]
    }
    const [u2, v2] = center(best)
    carve(u1, v1, u2, v2)
    joined.push(r)
  }

  // walls: every edge between floor and rock, merged into long runs
  const walls: TestMapLayout['walls'] = []
  const doors: TestMapLayout['doors'] = []
  const floor = (u: number, v: number) => at(u, v) !== ROCK
  for (let v = 0; v <= rows; v++) {
    let start = -1
    for (let u = 0; u <= cols; u++) {
      const edge = u < cols && floor(u, v - 1) !== floor(u, v)
      if (edge && start < 0) start = u
      if (!edge && start >= 0) {
        walls.push([start, v, u, v])
        start = -1
      }
    }
  }
  for (let u = 0; u <= cols; u++) {
    let start = -1
    for (let v = 0; v <= rows; v++) {
      const edge = v < rows && floor(u - 1, v) !== floor(u, v)
      if (edge && start < 0) start = v
      if (!edge && start >= 0) {
        walls.push([u, start, u, v])
        start = -1
      }
    }
  }
  // doors: where a one-cell-wide corridor enters a room
  for (let v = 1; v < rows; v++) {
    for (let u = 0; u < cols; u++) {
      const a = at(u, v - 1)
      const b = at(u, v)
      if (!((a === ROOM && b === HALL) || (a === HALL && b === ROOM))) continue
      const hv = a === HALL ? v - 1 : v
      if (at(u - 1, hv) !== ROCK || at(u + 1, hv) !== ROCK || rand() > 0.75) continue
      walls.push([u, v, u + 1, v])
      doors.push([u, v, u + 1, v])
    }
  }
  for (let u = 1; u < cols; u++) {
    for (let v = 0; v < rows; v++) {
      const a = at(u - 1, v)
      const b = at(u, v)
      if (!((a === ROOM && b === HALL) || (a === HALL && b === ROOM))) continue
      const hu = a === HALL ? u - 1 : u
      if (at(hu, v - 1) !== ROCK || at(hu, v + 1) !== ROCK || rand() > 0.75) continue
      walls.push([u, v, u, v + 1])
      doors.push([u, v, u, v + 1])
    }
  }

  const [su, sv] = center(rooms[0])
  return { cells, at, rooms, walls, doors, spawn: [su, sv] as [number, number] }
}

/** Draws the dungeon; returns the picture and its walls, doors and spawn point. */
export function generateTestMap(cols: number, rows: number, cellPx: number, seed: number) {
  const rand = mulberry32(seed)
  const p = plan(cols, rows, rand)
  const c = cellPx
  const canvas = new OffscreenCanvas(cols * c, rows * c)
  const ctx = canvas.getContext('2d')!

  // grain shared by rock and floor
  const noise = new OffscreenCanvas(256, 256)
  const nctx = noise.getContext('2d')!
  const img = nctx.createImageData(256, 256)
  for (let i = 0; i < img.data.length; i += 4) {
    const g = 100 + rand() * 120
    img.data[i] = img.data[i + 1] = img.data[i + 2] = g
    img.data[i + 3] = 255
  }
  nctx.putImageData(img, 0, 0)
  const grain = ctx.createPattern(noise, 'repeat')!

  ctx.fillStyle = '#1d1a16'
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  // flagstones
  const line = Math.max(1, c * 0.03)
  for (let v = 0; v < rows; v++) {
    for (let u = 0; u < cols; u++) {
      const k = p.at(u, v)
      if (k === ROCK) continue
      const light = k === ROOM ? 38 + rand() * 9 : 31 + rand() * 6
      ctx.fillStyle = `hsl(${k === ROOM ? 34 : 28}, ${10 + rand() * 6}%, ${light}%)`
      ctx.fillRect(u * c, v * c, c, c)
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.28)'
      ctx.lineWidth = line
      ctx.strokeRect(u * c + line / 2, v * c + line / 2, c - line, c - line)
      if (rand() < 0.35) {
        ctx.beginPath()
        if (rand() < 0.5) {
          ctx.moveTo(u * c + c / 2, v * c)
          ctx.lineTo(u * c + c / 2, v * c + c)
        } else {
          ctx.moveTo(u * c, v * c + c / 2)
          ctx.lineTo(u * c + c, v * c + c / 2)
        }
        ctx.stroke()
      }
    }
  }
  ctx.globalCompositeOperation = 'overlay'
  ctx.globalAlpha = 0.55
  ctx.fillStyle = grain
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.globalCompositeOperation = 'source-over'
  ctx.globalAlpha = 1

  // furniture
  for (const r of p.rooms) {
    if (rand() < 0.45 && r.w >= 5 && r.h >= 5) {
      const rw = 2 + Math.floor(rand() * (r.w - 3))
      const rh = 2 + Math.floor(rand() * (r.h - 3))
      const ru = r.u + 1 + Math.floor(rand() * (r.w - rw - 1))
      const rv = r.v + 1 + Math.floor(rand() * (r.h - rh - 1))
      ctx.fillStyle = 'rgba(122, 32, 30, 0.75)'
      ctx.fillRect(ru * c + c * 0.15, rv * c + c * 0.15, rw * c - c * 0.3, rh * c - c * 0.3)
      ctx.strokeStyle = 'rgba(214, 170, 82, 0.8)'
      ctx.lineWidth = c * 0.05
      ctx.strokeRect(ru * c + c * 0.25, rv * c + c * 0.25, rw * c - c * 0.5, rh * c - c * 0.5)
    }
    const items = 1 + Math.floor(rand() * 4)
    for (let i = 0; i < items; i++) {
      const u = r.u + Math.floor(rand() * r.w)
      const v = r.v + (rand() < 0.5 ? 0 : r.h - 1)
      const x = u * c + c / 2
      const y = v * c + c / 2
      if (rand() < 0.5) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.35)'
        ctx.beginPath()
        ctx.arc(x + c * 0.05, y + c * 0.07, c * 0.32, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = '#6a4423'
        ctx.beginPath()
        ctx.arc(x, y, c * 0.3, 0, Math.PI * 2)
        ctx.fill()
        ctx.strokeStyle = '#2c1b0d'
        ctx.lineWidth = c * 0.04
        ctx.stroke()
        ctx.beginPath()
        ctx.arc(x, y, c * 0.18, 0, Math.PI * 2)
        ctx.stroke()
      } else {
        const s = c * 0.66
        ctx.fillStyle = 'rgba(0, 0, 0, 0.35)'
        ctx.fillRect(x - s / 2 + c * 0.05, y - s / 2 + c * 0.07, s, s)
        ctx.fillStyle = '#7b5530'
        ctx.fillRect(x - s / 2, y - s / 2, s, s)
        ctx.strokeStyle = '#3a240f'
        ctx.lineWidth = c * 0.04
        ctx.strokeRect(x - s / 2, y - s / 2, s, s)
        ctx.beginPath()
        ctx.moveTo(x - s / 2, y - s / 2)
        ctx.lineTo(x + s / 2, y + s / 2)
        ctx.moveTo(x + s / 2, y - s / 2)
        ctx.lineTo(x - s / 2, y + s / 2)
        ctx.stroke()
      }
    }
  }

  // walls: a soft fake shadow, the stone and a light top
  const doorEdges = new Set(p.doors.map((d) => d.join()))
  const wallPath = () => {
    ctx.beginPath()
    for (const w of p.walls) {
      if (doorEdges.has(w.join())) continue
      ctx.moveTo(w[0] * c, w[1] * c)
      ctx.lineTo(w[2] * c, w[3] * c)
    }
  }
  ctx.lineCap = 'square'
  wallPath()
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)'
  ctx.lineWidth = c * 0.42
  ctx.stroke()
  ctx.lineWidth = c * 0.32
  ctx.stroke()
  ctx.strokeStyle = '#3b3029'
  ctx.lineWidth = c * 0.22
  ctx.stroke()
  ctx.strokeStyle = '#5c4d40'
  ctx.lineWidth = c * 0.07
  ctx.stroke()

  // doors in the picture: planks across the opening
  ctx.lineCap = 'butt'
  for (const d of p.doors) {
    const horizontal = d[1] === d[3]
    const x1 = d[0] * c + (horizontal ? c * 0.06 : 0)
    const y1 = d[1] * c + (horizontal ? 0 : c * 0.06)
    const x2 = d[2] * c - (horizontal ? c * 0.06 : 0)
    const y2 = d[3] * c - (horizontal ? 0 : c * 0.06)
    ctx.beginPath()
    ctx.moveTo(x1, y1)
    ctx.lineTo(x2, y2)
    ctx.strokeStyle = '#2c1b0d'
    ctx.lineWidth = c * 0.2
    ctx.stroke()
    ctx.strokeStyle = '#8a5f33'
    ctx.lineWidth = c * 0.13
    ctx.stroke()
  }

  const layout: TestMapLayout = { cols, rows, cellPx, walls: p.walls, doors: p.doors, spawn: p.spawn }
  return { canvas, layout }
}
