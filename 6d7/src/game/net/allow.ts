// What a player may change on the map of the game; the master's tab checks every change of a
// player before it applies it (the server will check the same). The player's own map already
// keeps to these rules — a refused change means the two have parted, and the master resends the map.
import type { CampaignSettings } from '../../campaign'
import type { ExploredMask } from '../../map/core/explored'
import { doorSeen, playersSee } from '../../map/core/exploring'
import { pinToImage } from '../../map/core/geometry'
import { rulesOf } from '../../map/core/scene'
import type { FlowColor, MapOp, MapScene, Token } from '../../map/core/types'
import { moveBlockers, pathBlocked } from '../../map/core/visibility'
import { companionTokenId } from '../player/tokens'

/** What the master's tab knows of the player and the map besides the scene. */
export interface PlayerContext {
  /** what players have seen on this map (static fog) */
  explored?: ExploredMask | null
  /** the player's color: their lines are drawn in it */
  color?: FlowColor
  /** the hero or the companion as the player's sheet makes them (null — no such token) */
  expected?: (token: Token) => Omit<Token, 'pin'> | null
}

/** A line no longer than this many numbers (x, y pairs): a stroke of a whole map, not a flood. */
const MAX_LINE = 20000

// the fields of a token a sheet decides; nothing else may come with it
const TOKEN_FIELDS = ['id', 'kind', 'name', 'color', 'image', 'owner', 'darkvision'] as const
const extra = (t: object) => Object.keys(t).some((k) => k !== 'pin' && !(TOKEN_FIELDS as readonly string[]).includes(k))
const sameToken = (a: Omit<Token, 'pin'>, b: Omit<Token, 'pin'>) => !extra(a) && TOKEN_FIELDS.every((k) => (a[k] ?? null) === (b[k] ?? null))

export function allowPlayerOp(scene: MapScene, campaign: CampaignSettings, player: string, op: MapOp, ctx: PlayerContext = {}): boolean {
  const rules = rulesOf(scene, campaign)
  const own = (t: Pick<Token, 'id' | 'kind'>) => t.kind === 'player' && (t.id === player || t.id === companionTokenId(player))
  switch (op.type) {
    // the own tokens, while players move freely: put where players see, as the sheet makes them;
    // moved where no wall stands between (into the fog too: that is how players explore)
    case 'token.add': {
      const t = op.token
      if (!rules.freeMove || !own(t) || scene.tokens.some((x) => x.id === t.id)) return false
      const want = ctx.expected ? ctx.expected(t) : t
      return !!want && sameToken(t, want) && playersSee(scene, pinToImage(t.pin, scene.grid), ctx.explored, campaign)
    }
    case 'token.update': {
      const t = scene.tokens.find((x) => x.id === op.id)
      const pin = op.patch.pin
      if (!t || !own(t) || !rules.freeMove || !pin || Object.keys(op.patch).some((k) => k !== 'pin')) return false
      return !pathBlocked(pinToImage(t.pin, scene.grid), pinToImage(pin, scene.grid), moveBlockers(scene))
    }
    // a closed door players see; players only open doors
    case 'door.open': {
      const d = scene.doors.find((x) => x.id === op.id)
      return rules.freeDoors && op.open && !!d && !d.open && doorSeen(scene, d, ctx.explored, campaign)
    }
    // lines: one's own, in one's color; the eraser takes any line but the master's
    case 'draw.add': {
      const { drawing: d } = op
      const p = d.points
      const shape = Array.isArray(p) && p.length >= 2 && p.length % 2 === 0 && p.length <= MAX_LINE && p.every(Number.isFinite)
      return d.author === player && (!ctx.color || d.color === ctx.color) && shape && !scene.drawings.some((x) => x.id === d.id)
    }
    case 'draw.remove':
      return op.ids.every((id) => scene.drawings.find((d) => d.id === id)?.author !== 'master')
    default:
      return false
  }
}
