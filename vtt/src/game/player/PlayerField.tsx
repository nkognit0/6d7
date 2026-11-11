// The game of a player (D&D VTT / game / player 30:3546): the map, the big buttons of the sheets,
// the inventories and the dice on the left, the token and the drawing tools on the right, the log
// of rolls in the corner. No top panel.
import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import type { PlayerSlot, CampaignSettings } from '../../campaign'
import { useStrings } from '../../i18n'
import {
  createScene, MapStore, MapView, rulesOf, useMapScene, type ExploredMask, type MapEngine, type MapTool, type MapViewState, type TileProvider, type Token
} from '../../map'
import { ColorIcon, GameMenuButton, IconButton, Plate, PlayerIcon, type PlayerIcon42Name } from '../../ui'
import type { Roll } from '../net/protocol'
import type { Seat } from '../seat/seat'
import { DiceWindow, LogPanel, rollEntry, type RollEntry } from './Dice'
import { SeatWindow, type SeatPage } from './SeatWindow'
import { companionToken, companionTokenId, followSheet, heroToken } from './tokens'
import { useSeatWizards } from './useSeatWizards'
import styles from './Player.module.css'

type Page = SeatPage | 'dice'
const PAGES: [Page, PlayerIcon42Name][] = [['sheet', 'sheet.character'], ['companion', 'sheet.sidekick'], ['items', 'inventory'], ['spells', 'spells'], ['dice', 'dice']]

/** The map on the field: the master's (kept up to date by the master's tab) or the development one. */
export interface FieldMap {
  store: MapStore
  tiles: TileProvider
  explored?: ExploredMask
}

// no map yet: the plates stay, the map is empty
const NO_MAP = new MapStore(createScene())

export function PlayerField({ player, seat, onChange, settings, map, onRoll, own }: {
  player: PlayerSlot
  seat: Seat
  onChange: (seat: Seat) => void
  settings: CampaignSettings
  /** null — the master has not chosen a map yet */
  map: FieldMap | null
  /** a roll goes to the master's log too */
  onRoll?: (roll: Roll) => void
  /**
   * the development map: this tab puts the hero on the spawn point and keeps the tokens following
   * the sheet (in the game the master's tab does it)
   */
  own?: boolean
}) {
  const s = useStrings()
  const store = map?.store ?? NO_MAP
  const scene = useMapScene(store)
  const wizards = useSeatWizards(seat, onChange)
  const companionId = companionTokenId(player.id)
  const [page, setPage] = useState<Page | null>(null)
  const [tool, setTool] = useState<MapTool>('select')
  const [log, setLog] = useState<RollEntry[]>([])
  const engine = useRef<MapEngine | null>(null)
  const [diceAnchor, setDiceAnchor] = useState<HTMLElement | null>(null)
  const placed = useRef(false)

  // the tokens follow the sheet: the portrait in the player's ring, darkvision and light by the rules
  const hero = useMemo(() => heroToken(player, seat), [player, seat])
  const companion = useMemo(() => companionToken(player, seat), [player, seat])

  // the development map: the hero stands on the spawn point when the game opens
  useEffect(() => {
    if (!own) return
    const now = store.get()
    const t = now.tokens.find((x) => x.id === hero.id)
    const patch = t && followSheet(t, hero)
    if (!t && !placed.current && now.spawn) {
      placed.current = true
      store.dispatch({ type: 'token.add', token: { ...hero, pin: now.spawn } })
    } else if (t && patch) store.dispatch({ type: 'token.update', id: t.id, patch })
  }, [own, store, hero])
  useEffect(() => {
    if (!own) return
    const t = store.get().tokens.find((x) => x.id === companionId)
    const patch = t && companion && followSheet(t, companion)
    if (t && !companion) store.dispatch({ type: 'token.remove', id: companionId })
    else if (t && patch) store.dispatch({ type: 'token.update', id: companionId, patch })
  }, [own, store, companion, companionId])

  const view = useMemo<MapViewState>(
    () => ({ role: 'player', playerId: player.id, drawColor: player.color, tool, brush: 4, campaignRules: settings }),
    [player.id, player.color, tool, settings]
  )
  // a token goes onto the map while players move freely
  const free = !!map && rulesOf(scene, settings).freeMove
  const onMap = (id: string) => scene.tokens.some((t) => t.id === id)
  const dragIn = (token: Omit<Token, 'pin'>) => (e: ReactPointerEvent) => {
    e.preventDefault()
    engine.current?.dragToken(token, e.nativeEvent)
  }
  const pick = (t: MapTool) => setTool(tool === t ? 'select' : t)
  const eraseMine = () => store.dispatch({ type: 'draw.remove', ids: scene.drawings.filter((d) => d.author === player.id).map((d) => d.id) })
  const label: Record<Page, string> = { sheet: s.player.nav.sheet, companion: s.player.nav.companion, items: s.player.nav.inventory, spells: s.player.nav.spells, dice: s.player.nav.dice }

  return (
    <div className={styles.field}>
      {map ? (
        <MapView store={map.store} tiles={map.tiles} view={view} explored={map.explored} onEngine={(e) => (engine.current = e)} />
      ) : (
        <p className={styles.preparing}>{s.player.noMap}</p>
      )}

      <Plate edge="left" className={styles.leftPlate}>
        {PAGES.map(([p, icon]) => (
          <GameMenuButton key={p} icon={icon} color={player.color} label={label[p]} open={page === p}
            onClick={(e) => {
              if (p === 'dice') setDiceAnchor(e.currentTarget)
              setPage(page === p ? null : p)
            }} />
        ))}
      </Plate>

      <Plate edge="right" className={styles.rightPlate}>
        <IconButton label={s.player.tools.token} disabled={!free || onMap(hero.id)} icon={<PlayerIcon name="character.figure.avatar" color={player.color} />}
          onPointerDown={dragIn(hero)} />
        {companion && (
          <IconButton label={s.player.companionToken} disabled={!free || onMap(companionId)} onPointerDown={dragIn(companion)}
            icon={<span className={styles.companionIcon} style={{ color: `var(--flow-${player.color})` }}>{(companion.name || s.player.companionToken).charAt(0).toUpperCase()}</span>} />
        )}
        <IconButton variant="switch" disabled={!map} pressed={!!map && tool === 'pencil'} label={s.player.tools.pencil} icon={<PlayerIcon name="character.pencil" color={player.color} />}
          onClick={() => pick('pencil')} />
        <IconButton variant="switch" disabled={!map} pressed={!!map && tool === 'draw-erase'} label={`${s.player.tools.eraser}. ${s.player.tools.eraserHint}`} icon={<ColorIcon name="character.eraser" />}
          onClick={() => pick('draw-erase')} onDoubleClick={eraseMine} />
      </Plate>

      <LogPanel entries={log} className={styles.fieldLog} />

      {page === 'dice' && (
        <DiceWindow anchor={diceAnchor} onClose={() => setPage(null)}
          onRoll={(r) => {
            setLog((l) => [...l, rollEntry(player.name || String(seat.sheet.name || ''), player.color, r)])
            onRoll?.(r)
          }} />
      )}
      {page && page !== 'dice' && <SeatWindow page={page} seat={seat} onChange={onChange} wizards={wizards} onClose={() => setPage(null)} />}
      {wizards.element}
    </div>
  )
}
