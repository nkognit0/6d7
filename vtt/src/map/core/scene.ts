import { newId } from './geometry'
import type { MapOp, MapScene } from './types'

export function createScene(name = ''): MapScene {
  return {
    id: newId(),
    name,
    image: null,
    grid: { enabled: true, size: 2, offsetX: 0, offsetY: 0 },
    rules: { freeMove: true, freeDoors: true, darkness: false, dynamicFog: false },
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
    case 'rules':
      return { ...scene, rules: { ...scene.rules, ...op.patch } }
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
    case 'fog.clear':
      return { ...scene, fog: [] }
  }
}
