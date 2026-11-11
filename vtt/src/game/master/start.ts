// The master's game over the campaign: starting it (the editor's later edits come into the maps of
// the game) and moving the game to another map.
import {
  emptyGame, exploredKey, freshGameMap, GAME_KEY, gameMapKey, mergeGameMap, placePlayers, type CampaignSession, type Change
} from '../../campaign'
import { heroToken } from '../player/tokens'

/**
 * Starts the game of an open campaign: the maps it has played take the editor's edits made since
 * (once, here: while the master is in the editor the game stands), maps the editor deleted leave
 * the game.
 */
export function startGame(session: CampaignSession) {
  const changes: Change[] = []
  const game = session.gameDoc
  if (!game) changes.push({ doc: GAME_KEY, set: emptyGame() })
  const maps = session.campaign.maps
  for (const id of Object.keys(session.docs().gameMaps ?? {})) {
    const editor = session.map(id)?.get()
    const played = session.gameMap(id)
    if (!played) continue
    if (!editor || !maps.includes(id)) {
      changes.push({ doc: gameMapKey(id), drop: true })
      if (session.exploredOf(id)) changes.push({ doc: exploredKey(id), drop: true })
      continue
    }
    if (JSON.stringify(played.base) === JSON.stringify(editor)) continue
    const { map, explored } = mergeGameMap(editor, { schema: 1, scene: played.store.get(), base: played.base }, session.exploredOf(id))
    changes.push({ doc: gameMapKey(id), set: map })
    if (explored) changes.push({ doc: exploredKey(id), set: explored })
    else if (session.exploredOf(id)) changes.push({ doc: exploredKey(id), drop: true })
  }
  if (game?.active && !maps.includes(game.active)) changes.push({ doc: GAME_KEY, set: { ...game, active: null } })
  if (changes.length) session.apply(changes, { record: false })
}

/**
 * The second click on a map: the game goes there. A map played before keeps its state; the heroes
 * stand on its spawn point, or leave the field without one.
 */
export function activateMap(session: CampaignSession, id: string) {
  const editor = session.map(id)?.get()
  if (!editor) return
  const changes: Change[] = []
  const played = session.gameMap(id)
  const scene = played?.store.get() ?? editor
  if (!played) changes.push({ doc: gameMapKey(id), set: freshGameMap(editor) })
  const heroes = session.campaign.players.map((p) => heroToken(p, session.seat(p.id)))
  for (const op of placePlayers(scene, heroes)) changes.push({ doc: gameMapKey(id), op })
  changes.push({ doc: GAME_KEY, set: { ...(session.gameDoc ?? emptyGame()), active: id } })
  session.apply(changes, { record: false })
}
