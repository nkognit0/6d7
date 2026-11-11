// The development map of the player's game (#/join/<code>/stub): a generated dungeon with its walls,
// doors, the spawn point and fog over everything, to try the player's screen without the master.
// Kept in memory only.
import { useEffect, useMemo, useState } from 'react'
import { createScene, createTestMap, MapStore, MemoryTileProvider, newId, PX_PER_GRID_UNIT, type MapScene } from '../../map'
import type { FieldMap } from './PlayerField'

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

/** The development map, made once per screen; null while it is being made. */
export function useStubMap(name: string): FieldMap | null {
  const tiles = useMemo(() => new MemoryTileProvider(), [])
  const [map, setMap] = useState<FieldMap | null>(null)
  useEffect(() => {
    let live = true
    stubScene(tiles, name).then((scene) => live && setMap({ store: new MapStore(scene), tiles }))
    return () => {
      live = false
    }
  }, [tiles, name])
  return map
}
