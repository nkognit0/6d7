import type { GridSettings, MapOp, MapRules, MapScene, Token } from './types'

/**
 * The operations that take `op` back («Отменить» of the editor). Computed on the scene before
 * `op`; valid while the history is undone in order, last change first.
 */
export function invertMapOp(scene: MapScene, op: MapOp): MapOp[] {
  switch (op.type) {
    case 'scene':
      return [{ type: 'scene', scene }]
    case 'image':
      return [{ type: 'image', image: scene.image }]
    case 'grid': {
      const patch: Partial<GridSettings> = {}
      for (const k of Object.keys(op.patch) as (keyof GridSettings)[]) (patch as Record<string, unknown>)[k] = scene.grid[k]
      return [{ type: 'grid', patch }]
    }
    case 'rules': {
      const patch: { [K in keyof MapRules]?: boolean | null } = {}
      for (const k of Object.keys(op.patch) as (keyof MapRules)[]) patch[k] = scene.rules[k] ?? null
      return [{ type: 'rules', patch }]
    }
    case 'wall.add':
      return [{ type: 'build.remove', ids: [op.wall.id] }]
    case 'door.add':
      return [{ type: 'build.remove', ids: [op.door.id] }]
    case 'door.open': {
      const d = scene.doors.find((x) => x.id === op.id)
      return d ? [{ type: 'door.open', id: d.id, open: d.open }] : []
    }
    case 'spawn':
      return [{ type: 'spawn', pin: scene.spawn }]
    case 'build.remove': {
      // a removed wall takes its doors with it: they come back too
      const ids = new Set(op.ids)
      const walls = scene.walls.filter((w) => ids.has(w.id))
      const doors = scene.doors.filter((d) => ids.has(d.id) || ids.has(d.wallId))
      return [...walls.map((wall): MapOp => ({ type: 'wall.add', wall })), ...doors.map((door): MapOp => ({ type: 'door.add', door }))]
    }
    case 'token.add': {
      const was = scene.tokens.find((t) => t.id === op.token.id)
      return [was ? { type: 'token.add', token: was } : { type: 'token.remove', id: op.token.id }]
    }
    case 'token.update': {
      const t = scene.tokens.find((x) => x.id === op.id)
      if (!t) return []
      const patch: Partial<Token> = {}
      for (const k of Object.keys(op.patch) as (keyof Token)[]) (patch as Record<string, unknown>)[k] = t[k]
      return [{ type: 'token.update', id: t.id, patch }]
    }
    case 'token.remove': {
      const t = scene.tokens.find((x) => x.id === op.id)
      return t ? [{ type: 'token.add', token: t }] : []
    }
    case 'draw.add':
      return [{ type: 'draw.remove', ids: [op.drawing.id] }]
    case 'draw.remove': {
      const ids = new Set(op.ids)
      return scene.drawings.filter((d) => ids.has(d.id)).map((drawing): MapOp => ({ type: 'draw.add', drawing }))
    }
    case 'fog.add':
      // a cover replaces every stroke; a brush stroke is the last one and simply goes away
      return op.stroke.mode === 'cover' ? [{ type: 'fog.set', strokes: scene.fog }] : [{ type: 'fog.remove', ids: [op.stroke.id] }]
    case 'fog.remove':
    case 'fog.set':
    case 'fog.clear':
      // the order of strokes matters (an eraser works on what is under it): the whole list
      return [{ type: 'fog.set', strokes: scene.fog }]
  }
}
