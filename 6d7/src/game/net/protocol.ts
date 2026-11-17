// The messages of a game between the master and the players: between tabs of one browser now
// (BroadcastChannel), over the network later. The master's tab holds the game, as the server
// will: players send it what they do, it checks, applies and tells everyone.
import type { CampaignSettings, PlayerSlot } from '../../campaign'
import type { ExploredData, MapOp, MapScene } from '../../map'
import type { SeatPatch } from '../seat/patch'
import type { Seat } from '../seat/seat'

/** What a player needs of the campaign. */
export interface CampaignInfo {
  id: string
  name: string
  settings: CampaignSettings
  players: PlayerSlot[]
}

/** The map of the game as it is now, with what players have seen on it. */
export interface MapPayload {
  id: string
  scene: MapScene
  explored: ExploredData | null
}

/** Everything a player's tab starts with. */
export interface JoinState {
  campaign: CampaignInfo
  /** the sheet of this player; null — not made yet */
  seat: Seat | null
  /** the map of the game; null — the master has not chosen one */
  map: MapPayload | null
}

export interface Roll {
  count: number
  die: number
  total: number
}

export type GameMessage =
  // ——— the master to the players ———
  /** the master opened the game: waiting players say hello again */
  | { type: 'host' }
  /** the master left: the game is over until the master comes back */
  | { type: 'end' }
  | { type: 'welcome'; to: string; state: JoinState }
  /** the game went to another map (null — to none) */
  | { type: 'map'; map: MapPayload | null }
  /** a change of the map of the game; `from` — the tab that made it (it has it already) */
  | { type: 'op'; map: string; op: MapOp; from: string | null }
  /** a change of a player's was refused: the map as it is, to that tab */
  | { type: 'resync'; to: string; map: MapPayload }
  /** a sheet changed by its fields (the master, a rest, a tab of the player); `from` — the tab that made it */
  | { type: 'seat'; player: string; patch: SeatPatch; from: string | null }
  /** the player's place is gone: the tab of that player stops */
  | { type: 'gone'; player: string }
  // ——— a player to the master ———
  | { type: 'hello'; tab: string; player: string }
  | { type: 'playerOp'; tab: string; player: string; map: string; op: MapOp }
  /** what the player changed in the sheet: only the changed fields, in pauses of typing */
  | { type: 'playerSeat'; tab: string; player: string; patch: SeatPatch }
  | { type: 'roll'; tab: string; player: string; roll: Roll }
