// The tokens of a player on the map: the hero and the companion, both in the player's color. What
// the sheet says (name, portrait, sight in darkness) the tokens follow; the player game and the
// master's game build them the same way.
import { visionOf } from '@app/rules/vision'
import type { PlayerSlot } from '../../campaign'
import type { Token } from '../../map'
import { characterOf, type Seat } from '../seat/seat'

type TokenData = Omit<Token, 'pin'>

const picture = (v: unknown) => (typeof v === 'string' && v.startsWith('media:') ? v : undefined)

export const companionTokenId = (playerId: string) => `${playerId}:companion`

/** The hero: the portrait of the sheet; darkvision and light by the rules (`vision.ts`). */
export function heroToken(player: PlayerSlot, seat: Seat | undefined): TokenData {
  return {
    id: player.id,
    kind: 'player',
    name: String(seat?.sheet.name || player.name),
    color: player.color,
    image: picture(seat?.sheet.appearance),
    darkvision: seat ? visionOf(characterOf(seat)).darkness : 0
  }
}

/** The companion, if the player has its sheet: its picture; the player moves it. */
export function companionToken(player: PlayerSlot, seat: Seat | undefined): TokenData | null {
  if (!seat?.companion) return null
  return {
    id: companionTokenId(player.id),
    kind: 'player',
    owner: player.id,
    name: String(seat.companion.name || ''),
    color: player.color,
    image: picture(seat.companion.portrait)
  }
}

/** What a token on the map has to change to follow its sheet; null — nothing. */
export function followSheet(t: Token, want: TokenData): Partial<Omit<Token, 'id'>> | null {
  const patch: Partial<Omit<Token, 'id'>> = {}
  for (const k of ['name', 'color', 'image', 'darkvision'] as const) if (t[k] !== want[k]) Object.assign(patch, { [k]: want[k] })
  return Object.keys(patch).length ? patch : null
}
