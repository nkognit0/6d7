// What a player may change on the map of the game; the master's tab checks every change of a
// player before it applies it (the server will check the same). The player's own map already
// keeps to these rules — a refused change means the two have parted, and the master resends the map.
import type { CampaignSettings } from '../../campaign'
import { pinToImage } from '../../map/core/geometry'
import { rulesOf } from '../../map/core/scene'
import type { MapOp, MapScene, Token } from '../../map/core/types'
import { moveBlockers, pathBlocked } from '../../map/core/visibility'
import { companionTokenId } from '../player/tokens'

export function allowPlayerOp(scene: MapScene, campaign: CampaignSettings, player: string, op: MapOp): boolean {
  const rules = rulesOf(scene, campaign)
  const own = (t: Pick<Token, 'id' | 'kind'>) => t.kind === 'player' && (t.id === player || t.id === companionTokenId(player))
  switch (op.type) {
    // the own tokens, while players move freely: put on the map, moved where no wall stands between
    case 'token.add':
      return rules.freeMove && own(op.token) && !scene.tokens.some((t) => t.id === op.token.id)
    case 'token.update': {
      const t = scene.tokens.find((x) => x.id === op.id)
      const pin = op.patch.pin
      if (!t || !own(t) || !rules.freeMove || !pin || Object.keys(op.patch).some((k) => k !== 'pin')) return false
      return !pathBlocked(pinToImage(t.pin, scene.grid), pinToImage(pin, scene.grid), moveBlockers(scene))
    }
    case 'door.open':
      return rules.freeDoors && scene.doors.some((d) => d.id === op.id)
    // lines: one's own; the eraser takes any line but the master's
    case 'draw.add':
      return op.drawing.author === player && !scene.drawings.some((d) => d.id === op.drawing.id)
    case 'draw.remove':
      return op.ids.every((id) => scene.drawings.find((d) => d.id === id)?.author !== 'master')
    default:
      return false
  }
}
