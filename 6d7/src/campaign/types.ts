// The documents of a campaign (docs/data-model.md): plain serializable objects shared by the
// editor, the game, the archive and (later) the server. No browser or React code here.
import type { Seat } from '../game/seat/seat'
import type { ExploredData } from '../map/core/explored'
import type { FlowColor, MapOp, MapRules, MapScene } from '../map/core/types'
import type { GameDoc, GameMap } from './game'

/** Settings of the campaign («Параметры»); maps override them one by one. */
export type CampaignSettings = Pick<MapRules, 'freeMove' | 'freeDoors' | 'dynamicFog'>

/** A place of a player: a name typed by the master and a color of its own. */
export interface PlayerSlot {
  id: string
  name: string
  color: FlowColor
}

/** A unique NPC of the master: a catalog token with its own name and description. */
export interface SavedNpc {
  id: string
  /** id of the catalog token (file name without the extension) */
  token: string
  name: string
  description: string
}

export interface Campaign {
  schema: 1
  id: string
  name: string
  settings: CampaignSettings
  /** 1–8 places, each with its own color */
  players: PlayerSlot[]
  /** map ids in the order of the editor's list; the first map gives the picture of the tile */
  maps: string[]
  npcs: SavedNpc[]
}

export const MAX_PLAYERS = 8

/** Every change of the campaign document. */
export type CampaignOp =
  | { type: 'rename'; name: string }
  | { type: 'settings'; patch: Partial<CampaignSettings> }
  | { type: 'player.add'; player: PlayerSlot; index?: number }
  | { type: 'player.update'; id: string; patch: Partial<Omit<PlayerSlot, 'id'>> }
  | { type: 'player.remove'; id: string }
  | { type: 'map.add'; id: string; index?: number }
  | { type: 'map.remove'; id: string }
  | { type: 'map.move'; id: string; index: number }
  /** adds or replaces a saved NPC */
  | { type: 'npc.put'; npc: SavedNpc; index?: number }
  | { type: 'npc.remove'; id: string }

/**
 * Names of the documents: `campaign`, `map/<id>`, `seat/<player id>`; the game — `game` (the active
 * map), `game/map/<id>` (a map as it is in the game) and `game/explored/<id>` (what players have
 * seen there).
 */
export type DocKey = 'campaign' | `map/${string}` | `seat/${string}` | 'game' | `game/map/${string}` | `game/explored/${string}`

export const mapKey = (id: string) => `map/${id}` as const
export const seatKey = (id: string) => `seat/${id}` as const

/**
 * One saved change: an operation on a document, a whole new document, or its removal. The journal
 * keeps them in order; «Отменить» and the network use the same changes.
 */
export type Change =
  | { doc: 'campaign'; op: CampaignOp }
  | { doc: `map/${string}`; op: MapOp }
  /** an operation on the scene of a map of the game */
  | { doc: `game/map/${string}`; op: MapOp }
  | { doc: DocKey; set: unknown }
  | { doc: DocKey; drop: true }

/** What the home screen shows of a campaign without opening it. */
export interface CampaignMeta {
  id: string
  name: string
  players: PlayerSlot[]
  /** picture of the first map (media store) */
  preview: string | null
  /** pictures of all maps: their tiles stay while some campaign uses them */
  images: string[]
  /** time of the last saved change, ms */
  updated: number
}

/** Every document of a campaign, as it is kept and archived. */
export interface CampaignDocs {
  campaign: Campaign
  maps: Record<string, MapScene>
  /** seats by player id (the sheet of a player who has not started yet is missing) */
  seats: Record<string, Seat>
  /** the game: missing until the master starts it */
  game?: GameDoc
  /** maps of the game by map id (only those the game has played) */
  gameMaps?: Record<string, GameMap>
  /** what players have seen on each map of the game */
  explored?: Record<string, ExploredData>
}
