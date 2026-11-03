import { newId } from './geometry'
import type { MapOp, MapRules, MapScene, RuleOverrides } from './types'

/** Settings of a new campaign; «Темнота» has no campaign setting and starts off. */
export const DEFAULT_RULES: MapRules = { freeMove: true, freeDoors: true, darkness: false, dynamicFog: false }

/**
 * The conditions that work on a map: the defaults, the campaign settings, then what the map
 * changed. Doors open freely only while tokens move freely (QnA).
 */
export function rulesOf(scene: Pick<MapScene, 'rules'>, campaign: RuleOverrides = {}): MapRules {
  const r = { ...DEFAULT_RULES }
  for (const layer of [campaign, scene.rules]) {
    for (const k of Object.keys(layer) as (keyof MapRules)[]) {
      const v = layer[k]
      if (typeof v === 'boolean') r[k] = v
    }
  }
  if (!r.freeMove) r.freeDoors = false
  return r
}

export function createScene(name = ''): MapScene {
  return {
    id: newId(),
    name,
    image: null,
    grid: { enabled: true, size: 2, offsetX: 0, offsetY: 0 },
    rules: {},
    walls: [],
    doors: [],
    spawn: null,
    tokens: [],
    drawings: [],
    fog: []
  }
}

/**
 * Applies one operation. Immutable: only the changed lists get new arrays, so the renderer
 * redraws a layer only when its list is a different object.
 */
export function applyOp(scene: MapScene, op: MapOp): MapScene {
  switch (op.type) {
    case 'scene':
      return op.scene
    case 'image':
      return { ...scene, image: op.image }
    case 'grid':
      return { ...scene, grid: { ...scene.grid, ...op.patch } }
    case 'rules': {
      const rules: RuleOverrides = { ...scene.rules }
      for (const k of Object.keys(op.patch) as (keyof MapRules)[]) {
        const v = op.patch[k]
        if (typeof v === 'boolean') rules[k] = v
        else if (v === null) delete rules[k]
      }
      return { ...scene, rules }
    }
    case 'wall.add':
      return { ...scene, walls: [...scene.walls, op.wall] }
    case 'door.add':
      return { ...scene, doors: [...scene.doors, op.door] }
    case 'door.open':
      return { ...scene, doors: scene.doors.map((d) => (d.id === op.id ? { ...d, open: op.open } : d)) }
    case 'spawn':
      return { ...scene, spawn: op.pin }
    case 'build.remove': {
      const ids = new Set(op.ids)
      const walls = scene.walls.filter((w) => !ids.has(w.id))
      const doors = scene.doors.filter((d) => !ids.has(d.id) && !ids.has(d.wallId))
      return { ...scene, walls: walls.length === scene.walls.length ? scene.walls : walls, doors: doors.length === scene.doors.length ? scene.doors : doors }
    }
    case 'token.add':
      return { ...scene, tokens: [...scene.tokens.filter((t) => t.id !== op.token.id), op.token] }
    case 'token.update':
      return { ...scene, tokens: scene.tokens.map((t) => (t.id === op.id ? { ...t, ...op.patch } : t)) }
    case 'token.remove':
      return { ...scene, tokens: scene.tokens.filter((t) => t.id !== op.id) }
    case 'draw.add':
      return { ...scene, drawings: [...scene.drawings, op.drawing] }
    case 'draw.remove': {
      const ids = new Set(op.ids)
      return { ...scene, drawings: scene.drawings.filter((d) => !ids.has(d.id)) }
    }
    case 'fog.add':
      // covering the whole map makes earlier strokes meaningless
      return { ...scene, fog: op.stroke.mode === 'cover' ? [op.stroke] : [...scene.fog, op.stroke] }
    case 'fog.remove': {
      const ids = new Set(op.ids)
      return { ...scene, fog: scene.fog.filter((s) => !ids.has(s.id)) }
    }
    case 'fog.set':
      return { ...scene, fog: op.strokes }
    case 'fog.clear':
      return { ...scene, fog: [] }
  }
}
