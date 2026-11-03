// The interactive map of D&D VTT: data, picture import, renderer and the React view.
// Screens use only what is exported here.

export * from './core/types'
export { cellPx, feetToPx, pinToImage, newId, FEET_PER_CELL, PX_PER_GRID_UNIT } from './core/geometry'
export { createScene, applyOp } from './core/scene'
export { MapStore, type OpSource, type StoreListener } from './core/store'
export { sightBlockers, moveBlockers, visibilityPolygon, visionRadius, pathBlocked, type Segment } from './core/visibility'
export { MAP_IMAGE_ACCEPT, MAX_IMAGE_SIDE, type ImageFormat } from './image/format'
export { importMapImage, createTestMap, MemoryTileProvider, MapImageError, TILE_SIZE, type ImportedImage, type ImportProgress } from './image/pyramid'
export type { TestMapLayout } from './image/protocol'
export { MapEngine, type MapRole, type MapTool, type MapViewState, type MapStats, type ZoomInfo } from './engine/MapEngine'
export { CELL_AT_100 } from './engine/camera'
export { MapView, type MapViewProps } from './react/MapView'
export { useMapScene } from './react/useMapScene'
