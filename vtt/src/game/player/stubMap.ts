// The map of the player's game until the game between tabs (plan, step 9): a generated dungeon with
// its walls, doors, the spawn point and fog over everything. Kept in memory only.
import { createScene, createTestMap, newId, PX_PER_GRID_UNIT, type MapScene, type MemoryTileProvider } from '../../map'

export async function stubScene(tiles: MemoryTileProvider, name: string): Promise<MapScene> {
  const img = await createTestMap({ cols: 30, rows: 30, cellPx: 100, seed: 3 }, tiles)
  const { layout } = img
  const node = (u: number, v: number) => ({ space: 'grid' as const, u, v })
  const walls = layout.walls.map(([u1, v1, u2, v2]) => ({ id: newId(), kind: 'wall' as const, a: node(u1, v1), b: node(u2, v2) }))
  const wallOf = new Map(layout.walls.map((w, i) => [w.join(), walls[i].id]))
  const doors = layout.doors.map(([u1, v1, u2, v2]) => ({ id: newId(), wallId: wallOf.get([u1, v1, u2, v2].join())!, a: node(u1, v1), b: node(u2, v2), open: false }))
  const base = createScene(name)
  return {
    ...base,
    image: img.info,
    grid: { ...base.grid, size: layout.cellPx / PX_PER_GRID_UNIT },
    walls,
    doors,
    spawn: { space: 'grid', u: layout.spawn[0] + 0.5, v: layout.spawn[1] + 0.5 },
    fog: [{ id: newId(), mode: 'cover' }]
  }
}
