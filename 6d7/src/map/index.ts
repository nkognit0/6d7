// The interactive map of 6d7: data, picture import, renderer and the React view.
// Screens use only what is exported here.

export * from './core/types'
export { cellPx, feetToPx, pinToImage, newId, FEET_PER_CELL, PX_PER_GRID_UNIT } from './core/geometry'
export { createScene, applyOp, rulesOf, DEFAULT_RULES } from './core/scene'
export { invertMapOp } from './core/invert'
export { ExploredMask, EXPLORED_SIDE, sameProportions, type ExploredData } from './core/explored'
export { doorSeen, playersSee, playerSight, trackExplored, underFog, type ExploredTracker } from './core/exploring'
export { MapStore, type OpSource, type StoreListener } from './core/store'
export { sightBlockers, moveBlockers, visibilityPolygon, visionRadius, pathBlocked, type Segment } from './core/visibility'
export { MAP_IMAGE_ACCEPT, MAX_IMAGE_SIDE, type ImageFormat } from './image/format'
export { importMapImage, createTestMap, MemoryTileProvider, MapImageError, TILE_SIZE, type ImportedImage, type ImportProgress, type TileSink } from './image/pyramid'
export type { TestMapLayout, TileBlob } from './image/protocol'
export { resolveCatalog, resolveImages } from './engine/textures'
export { MapEngine, type MapRole, type MapTool, type MapViewState, type MapStats, type ZoomInfo } from './engine/MapEngine'
export { CELL_AT_100 } from './engine/camera'
export { MapView, type MapViewProps } from './react/MapView'
export { useMapScene } from './react/useMapScene'
