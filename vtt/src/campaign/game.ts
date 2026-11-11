// The game of a campaign (docs/data-model.md, «Слияние правок редактора с игрой»): the game keeps
// its own copy of each map it played and the editor's map it started from. When the master starts
// the game, every copy takes the editor's later edits: an object the editor changed since — the
// editor's version, an object only the game changed — the game's. No browser code: the server will
// merge the same way.
import { ExploredMask, type ExploredData } from '../map/core/explored'
import { cellPx, pinToImage } from '../map/core/geometry'
import { moveBlockers, pathBlocked } from '../map/core/visibility'
import type { MapOp, MapRules, MapScene, Pin, RuleOverrides, Token } from '../map/core/types'

/** `game`: which map the players are on. */
export interface GameDoc {
  schema: 1
  /** the active map; null — the master has not chosen one yet */
  active: string | null
}

/** `game/map/<id>`: the map as it is in the game and the editor's map it was merged with last. */
export interface GameMap {
  schema: 1
  scene: MapScene
  base: MapScene
}

export const GAME_KEY = 'game' as const
export const gameMapKey = (id: string) => `game/map/${id}` as const
export const exploredKey = (id: string) => `game/explored/${id}` as const

export const emptyGame = (): GameDoc => ({ schema: 1, active: null })

/** A map the game has not played yet: the editor's map as it is. */
export const freshGameMap = (editor: MapScene): GameMap => ({ schema: 1, scene: editor, base: editor })

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

/**
 * Objects with ids from three versions: `fromBase` — what the editor had at the last merge (the
 * editor's version if it changed the object since, else the game's; gone if either removed it),
 * `gameNew` — added in the game, `editorNew` — added in the editor since.
 */
function merge3<T extends { id: string }>(base: T[], editor: T[], game: T[]) {
  const before = new Map(base.map((x) => [x.id, x]))
  const inGame = new Map(game.map((x) => [x.id, x]))
  const inEditor = new Set(editor.map((x) => x.id))
  const fromBase: T[] = []
  const editorNew: T[] = []
  for (const x of editor) {
    const was = before.get(x.id)
    if (!was) editorNew.push(x)
    else if (!same(x, was)) fromBase.push(x)
    else {
      const now = inGame.get(x.id)
      if (now) fromBase.push(now)
    }
  }
  const gameNew = game.filter((x) => !before.has(x.id) && !inEditor.has(x.id))
  return { fromBase, gameNew, editorNew }
}

/** The map of the game with the editor's later edits (QnA, «Что важнее…»). */
export function mergeScene(base: MapScene, editor: MapScene, game: MapScene): MapScene {
  const tokens = merge3(base.tokens, editor.tokens, game.tokens)
  const drawings = merge3(base.drawings, editor.drawings, game.drawings)
  const fog = merge3(base.fog, editor.fog, game.fog)
  // doors: the game only opens and closes them
  const baseDoors = new Map(base.doors.map((d) => [d.id, d]))
  const gameDoors = new Map(game.doors.map((d) => [d.id, d]))
  const doors = editor.doors.map((d) => {
    const was = baseDoors.get(d.id)
    const now = gameDoors.get(d.id)
    return was && now && same(d, was) ? { ...d, open: now.open } : d
  })
  // conditions changed in the game stay, unless the editor changed the same one since
  const rules: RuleOverrides = {}
  const keys = new Set([...Object.keys(editor.rules), ...Object.keys(base.rules), ...Object.keys(game.rules)]) as Set<keyof MapRules>
  for (const k of keys) {
    const v = editor.rules[k] !== base.rules[k] ? editor.rules[k] : game.rules[k]
    if (v !== undefined) rules[k] = v
  }
  return {
    ...editor,
    rules,
    doors,
    tokens: [...tokens.fromBase, ...tokens.gameNew, ...tokens.editorNew],
    drawings: [...drawings.fromBase, ...drawings.gameNew, ...drawings.editorNew],
    // the editor's new fog comes last: it closes what players had explored
    fog: [...fog.fromBase, ...fog.gameNew, ...fog.editorNew]
  }
}

/**
 * A map of the game when the master starts it: the saved copy merged with the editor's map, the
 * explored mask with the editor's new fog applied (a picture of other proportions drops it).
 */
export function mergeGameMap(editor: MapScene, saved: GameMap | undefined, explored: ExploredData | undefined): { map: GameMap; explored: ExploredData | null } {
  if (!saved) return { map: freshGameMap(editor), explored: null }
  const scene = mergeScene(saved.base, editor, saved.scene)
  let open: ExploredData | null = null
  if (explored && editor.image) {
    const mask = new ExploredMask(editor.image, explored)
    const known = new Set(saved.base.fog.map((s) => s.id).concat(saved.scene.fog.map((s) => s.id)))
    for (const s of editor.fog) if (!known.has(s.id)) mask.hide(s)
    if (!mask.empty) open = mask.save()
  }
  return { map: { schema: 1, scene, base: editor }, explored: open }
}

/**
 * The tokens of the players when a map becomes active: the heroes on the spawn point and the
 * free cells nearest to it that no wall separates from it; without a spawn point — none (the
 * master places them). Companions are taken off either way.
 */
export function placePlayers(scene: MapScene, heroes: Omit<Token, 'pin'>[]): MapOp[] {
  const ops: MapOp[] = scene.tokens.filter((t) => t.kind === 'player').map((t) => ({ type: 'token.remove', id: t.id }))
  const spawn = scene.spawn
  if (!spawn || !heroes.length) return ops
  const cell = cellPx(scene.grid)
  const center = pinToImage(spawn, scene.grid)
  const blockers = moveBlockers(scene)
  const taken = scene.tokens.filter((t) => t.kind === 'npc').map((t) => pinToImage(t.pin, scene.grid))
  const inside = (p: { x: number; y: number }) => !scene.image || (p.x >= 0 && p.y >= 0 && p.x <= scene.image.width && p.y <= scene.image.height)
  const free = (p: { x: number; y: number }) => inside(p) && !taken.some((q) => Math.hypot(q.x - p.x, q.y - p.y) < cell / 2) && !pathBlocked(center, p, blockers)
  // rings of cells around the spawn point, the nearest first
  const spots: { pin: Pin; d: number }[] = []
  for (let r = 0; r <= 4; r++) {
    for (let du = -r; du <= r; du++) {
      for (let dv = -r; dv <= r; dv++) {
        if (Math.max(Math.abs(du), Math.abs(dv)) !== r) continue
        const pin: Pin = spawn.space === 'grid' ? { space: 'grid', u: spawn.u + du, v: spawn.v + dv } : { space: 'image', x: spawn.x + du * cell, y: spawn.y + dv * cell }
        spots.push({ pin, d: Math.hypot(du, dv) })
      }
    }
  }
  spots.sort((a, b) => a.d - b.d)
  let next = 0
  for (const hero of heroes) {
    while (next < spots.length && !free(pinToImage(spots[next].pin, scene.grid))) next++
    // more heroes than free cells: the rest share the spawn point
    const pin = next < spots.length ? spots[next++].pin : spawn
    ops.push({ type: 'token.add', token: { ...hero, pin } })
  }
  return ops
}
