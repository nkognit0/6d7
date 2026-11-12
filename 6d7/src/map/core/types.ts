// Data of one map: plain serializable objects shared by the editor, the game, the archive and
// (later) the server. No browser or rendering code here.

export type Vec = { x: number; y: number }

/**
 * A point of a map object. Tied to the grid (`u`, `v` in cells from the grid origin; a cell
 * center is `n + 0.5`) it stays in its cell when the master changes the grid. Free — in pixels
 * of the source image.
 */
export type Pin = { space: 'grid'; u: number; v: number } | { space: 'image'; x: number; y: number }

/** The eight player colors (Figma flow/*). */
export type FlowColor = 'red' | 'orange' | 'yellow' | 'green' | 'blue' | 'indigo' | 'purple' | 'scarlett'

export interface GridSettings {
  /**
   * off: walls, fog and tokens are placed freely; the cell size still sets the scale (5 ft).
   * Players do not see the grid: it shows around a token only while that player drags it.
   */
  enabled: boolean
  /** cell size on the 1–10 scale of the editor, see `cellPx` */
  size: number
  /** grid origin in pixels of the source image */
  offsetX: number
  offsetY: number
}

/** Conditions of the map; they win over the same settings of the campaign. */
export interface MapRules {
  /** players move their tokens themselves */
  freeMove: boolean
  /** players open doors themselves (only while they move freely) */
  freeDoors: boolean
  /** only darkvision and light reveal fogged areas */
  darkness: boolean
  /** areas players no longer see are fogged again */
  dynamicFog: boolean
}

/**
 * What a map changed in the settings of the campaign, like overrides of a Figma instance: a
 * missing key follows the campaign (QnA, «Как соотносятся настройки кампании и карты»).
 */
export type RuleOverrides = Partial<MapRules>

/** A wall hides and blocks; a barrier only blocks movement. */
export type WallKind = 'wall' | 'barrier'

export interface Wall {
  id: string
  kind: WallKind
  a: Pin
  b: Pin
}

/** A door takes one cell edge of a wall or barrier (5 ft without the grid). */
export interface Door {
  id: string
  wallId: string
  a: Pin
  b: Pin
  open: boolean
}

export interface Token {
  id: string
  kind: 'player' | 'npc'
  pin: Pin
  name: string
  /** player tokens: the ring color */
  color?: FlowColor
  /** portrait or NPC token image (URL) */
  image?: string
  /** a token of a player that is not the hero (a companion): the player who moves it */
  owner?: string
  /** NPC: id of the catalog token (the picture is found again by it) */
  token?: string
  /** NPC: the saved NPC of the campaign it became (its own name and description) */
  saved?: string
  /** vision in feet */
  darkvision?: number
  /** radius of an equipped light in feet */
  light?: number
}

/** A pencil line; its width is tied to the map size (scales with it, like a Figma stroke). */
export interface Drawing {
  id: string
  /** player id or 'master': players cannot erase the master's lines */
  author: string
  color: FlowColor | 'master'
  /** x, y pairs in pixels of the source image */
  points: number[]
}

/** The shape of a stroke of the master's fog brush; `cover` fills the whole map. */
export type FogShape =
  | { mode: 'paint' | 'erase'; radius: number; points: number[] }
  | { mode: 'cover' }

/** A stroke of the scene: the id lets «Отменить» take it back. */
export type FogStroke = FogShape & { id: string }

/** The uploaded picture: the tiles themselves come from a `TileProvider`. */
export interface MapImageInfo {
  id: string
  width: number
  height: number
  /** inner size of a tile; files are 1 px bigger on every side (no seams) */
  tileSize: number
  /** pyramid levels; level n is 2^n times smaller than the source */
  levels: number
  /** the uploaded file as is (media store, «media:<sha256>»): the archive, cutting the tiles again */
  original?: string
  /** the smallest level (media store): the picture of the campaign tile */
  preview?: string
}

export interface MapScene {
  id: string
  name: string
  image: MapImageInfo | null
  grid: GridSettings
  /** only what the map changed in the campaign settings, see `rulesOf` */
  rules: RuleOverrides
  walls: Wall[]
  doors: Door[]
  spawn: Pin | null
  tokens: Token[]
  drawings: Drawing[]
  /** fog strokes in order; replayed into a mask */
  fog: FogStroke[]
}

/** Every change of a map. Local edits and (later) the network go through the same operations. */
export type MapOp =
  | { type: 'scene'; scene: MapScene }
  | { type: 'name'; name: string }
  | { type: 'image'; image: MapImageInfo | null }
  | { type: 'grid'; patch: Partial<GridSettings> }
  /** `null` drops the override: the map follows the campaign again */
  | { type: 'rules'; patch: { [K in keyof MapRules]?: boolean | null } }
  | { type: 'wall.add'; wall: Wall }
  | { type: 'door.add'; door: Door }
  | { type: 'door.open'; id: string; open: boolean }
  | { type: 'spawn'; pin: Pin | null }
  /** walls (with their doors) and doors */
  | { type: 'build.remove'; ids: string[] }
  | { type: 'token.add'; token: Token }
  | { type: 'token.update'; id: string; patch: Partial<Omit<Token, 'id'>> }
  | { type: 'token.remove'; id: string }
  | { type: 'draw.add'; drawing: Drawing }
  | { type: 'draw.remove'; ids: string[] }
  | { type: 'fog.add'; stroke: FogStroke }
  | { type: 'fog.remove'; ids: string[] }
  /** puts back a whole list of strokes (undoing «cover» and «clear») */
  | { type: 'fog.set'; strokes: FogStroke[] }
  /** removes every fog stroke */
  | { type: 'fog.clear' }

/** Loads tiles of a picture: from memory now, from the server later. */
export interface TileProvider {
  load(image: MapImageInfo, level: number, col: number, row: number, signal?: AbortSignal): Promise<ImageBitmap>
}
