// The game of a player (D&D VTT / game / player 30:3546): the map, the big buttons of the sheets,
// the inventories and the dice on the left, the token and the drawing tools on the right, the log
// of rolls in the corner. No top panel.
import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { visionOf } from '@app/rules/vision'
import type { PlayerSlot, CampaignSettings } from '../../campaign'
import { useStrings } from '../../i18n'
import {
  MapStore, MapView, MemoryTileProvider, useMapScene, type MapEngine, type MapTool, type MapViewState, type Token
} from '../../map'
import { ColorIcon, GameMenuButton, IconButton, Plate, PlayerIcon, type PlayerIcon42Name } from '../../ui'
import { useMediaUrl } from '../media/media'
import { characterOf, type MediaRef, type Seat } from '../seat/seat'
import { DiceWindow, LogPanel, type RollEntry } from './Dice'
import { SeatWindow, type SeatPage } from './SeatWindow'
import { stubScene } from './stubMap'
import { useSeatWizards } from './useSeatWizards'
import styles from './Player.module.css'

type Page = SeatPage | 'dice'
const PAGES: [Page, PlayerIcon42Name][] = [['sheet', 'sheet.character'], ['companion', 'sheet.sidekick'], ['items', 'inventory'], ['spells', 'spells'], ['dice', 'dice']]

const asRef = (v: unknown) => (typeof v === 'string' && v.startsWith('media:') ? (v as MediaRef) : null)

export function PlayerField({ player, seat, onChange, settings }: {
  player: PlayerSlot
  seat: Seat
  onChange: (seat: Seat) => void
  settings: CampaignSettings
}) {
  const s = useStrings()
  const tiles = useMemo(() => new MemoryTileProvider(), [])
  const [store, setStore] = useState<MapStore | null>(null)
  useEffect(() => {
    let live = true
    stubScene(tiles, s.player.stubMap).then((scene) => live && setStore(new MapStore(scene)))
    return () => {
      live = false
    }
  }, [tiles, s])
  if (!store) return <div className={styles.field}><p className={styles.preparing}>{s.player.preparingMap}</p></div>
  return <Field player={player} seat={seat} onChange={onChange} settings={settings} store={store} tiles={tiles} />
}

function Field({ player, seat, onChange, settings, store, tiles }: {
  player: PlayerSlot
  seat: Seat
  onChange: (seat: Seat) => void
  settings: CampaignSettings
  store: MapStore
  tiles: MemoryTileProvider
}) {
  const s = useStrings()
  const scene = useMapScene(store)
  const wizards = useSeatWizards(seat, onChange)
  const [page, setPage] = useState<Page | null>(null)
  const [tool, setTool] = useState<MapTool>('select')
  const [log, setLog] = useState<RollEntry[]>([])
  const engine = useRef<MapEngine | null>(null)
  const [diceAnchor, setDiceAnchor] = useState<HTMLElement | null>(null)
  const placed = useRef(false)

  // the token: the portrait of the sheet in the player's ring; darkvision and light by the rules
  const portrait = useMediaUrl(asRef(seat.sheet.appearance))
  const companionPicture = useMediaUrl(asRef(seat.companion?.portrait))
  const vision = useMemo(() => visionOf(characterOf(seat)), [seat])
  const hero: Omit<Token, 'pin'> = {
    id: player.id, kind: 'player', name: String(seat.sheet.name || player.name), color: player.color,
    image: portrait ?? undefined, darkvision: vision.darkness
  }
  const companionId = `${player.id}:companion`
  const companion: Omit<Token, 'pin'> | null = seat.companion ? {
    id: companionId, kind: 'player', owner: player.id, name: String(seat.companion.name || ''), color: player.color, image: companionPicture ?? undefined
  } : null

  // the hero stands on the spawn point when the game opens; later its token follows the sheet
  useEffect(() => {
    const now = store.get()
    const t = now.tokens.find((x) => x.id === hero.id)
    if (!t && !placed.current && now.spawn) {
      placed.current = true
      store.dispatch({ type: 'token.add', token: { ...hero, pin: now.spawn } })
    } else if (t && (t.name !== hero.name || t.image !== hero.image || t.darkvision !== hero.darkvision || t.color !== hero.color)) {
      store.dispatch({ type: 'token.update', id: t.id, patch: { name: hero.name, image: hero.image, darkvision: hero.darkvision, color: hero.color } })
    }
  })
  useEffect(() => {
    const t = store.get().tokens.find((x) => x.id === companionId)
    if (t && !companion) store.dispatch({ type: 'token.remove', id: companionId })
    else if (t && companion && (t.name !== companion.name || t.image !== companion.image)) {
      store.dispatch({ type: 'token.update', id: companionId, patch: { name: companion.name, image: companion.image } })
    }
  })

  const view = useMemo<MapViewState>(
    () => ({ role: 'player', playerId: player.id, drawColor: player.color, tool, brush: 4, campaignRules: settings }),
    [player.id, player.color, tool, settings]
  )
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
      <MapView store={store} tiles={tiles} view={view} onEngine={(e) => (engine.current = e)} />

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
        <IconButton label={s.player.tools.token} disabled={onMap(hero.id)} icon={<PlayerIcon name="character.figure.avatar" color={player.color} />}
          onPointerDown={dragIn(hero)} />
        {companion && (
          <IconButton label={s.player.companionToken} disabled={onMap(companionId)} onPointerDown={dragIn(companion)}
            icon={<span className={styles.companionIcon} style={{ color: `var(--flow-${player.color})` }}>{(companion.name || s.player.companionToken).charAt(0).toUpperCase()}</span>} />
        )}
        <IconButton variant="switch" pressed={tool === 'pencil'} label={s.player.tools.pencil} icon={<PlayerIcon name="character.pencil" color={player.color} />}
          onClick={() => pick('pencil')} />
        <IconButton variant="switch" pressed={tool === 'draw-erase'} label={`${s.player.tools.eraser}. ${s.player.tools.eraserHint}`} icon={<ColorIcon name="character.eraser" />}
          onClick={() => pick('draw-erase')} onDoubleClick={eraseMine} />
      </Plate>

      <LogPanel entries={log} className={styles.fieldLog} />

      {page === 'dice' && (
        <DiceWindow anchor={diceAnchor} onClose={() => setPage(null)}
          onRoll={(r) => setLog((l) => [...l, { id: Date.now() + Math.random(), name: player.name || String(seat.sheet.name || ''), color: player.color, ...r }])} />
      )}
      {page && page !== 'dice' && <SeatWindow page={page} seat={seat} onChange={onChange} wizards={wizards} onClose={() => setPage(null)} />}
      {wizards.element}
    </div>
  )
}
