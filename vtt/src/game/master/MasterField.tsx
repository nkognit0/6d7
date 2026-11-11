// The map of the master's game: the active map (its changes are the game) or a map being looked at
// (a copy: nothing done there stays). In the bottom left corner — the dice and the tokens of the
// players to drag onto the map (46:10178).
import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { useShortcuts } from '../../app/shortcuts'
import { exploredKey, repo, type CampaignSession } from '../../campaign'
import { useStrings } from '../../i18n'
import { ExploredMask, MapStore, MapView, useMapScene, type MapEngine, type MapTool, type MapViewState, type Token } from '../../map'
import { Button, GameMenuButton, IconButton, Plate, PlayerIcon } from '../../ui'
import { DiceWindow, rollEntry, type RollEntry } from '../player/Dice'
import { companionToken, followSheet, heroToken } from '../player/tokens'
import type { Notice } from './MasterGame'
import styles from './Master.module.css'

/** The explored mask is written this long after players stop discovering the map. */
const SAVE_EXPLORED_MS = 2000

export function MasterField({ session, mapId, preview, tool, brush, notice, onNotice, onBack, onRoll, onEngine, explored }: {
  session: CampaignSession
  /** the map on the field; null — none chosen yet */
  mapId: string | null
  /** the map is only looked at */
  preview: boolean
  tool: MapTool
  brush: number
  notice: Notice
  onNotice: (notice: Notice) => void
  /** back to the map of the game; missing while the game is on no map yet */
  onBack?: () => void
  onRoll: (entry: RollEntry) => void
  /** the engine of the map of the game (not of a map being looked at) */
  onEngine: (engine: MapEngine | null) => void
  /** gets the explored mask of the map of the game while it is on the field */
  explored: { current: ExploredMask | null }
}) {
  const s = useStrings()
  const editor = mapId ? session.map(mapId)?.get() : undefined
  const played = mapId ? session.gameMap(mapId) : undefined
  // a map being looked at is a copy: the game's if it was played, else the editor's
  const store = useMemo(
    () => (!mapId ? null : preview ? new MapStore(played?.store.get() ?? editor!) : (played?.store ?? null)),
    [mapId, preview]
  )
  const bar = preview && editor ? (
    <div className={styles.notice}>
      <span>{s.master.previewOf(editor.name || s.editor.maps.untitled)}</span>
      {onBack && <Button variant="secondary" className={styles.noticeButton} onClick={onBack}>{s.master.backToGame}</Button>}
    </div>
  ) : notice ? (
    <button type="button" className={notice.kind === 'error' ? styles.noticeError : styles.notice} onClick={() => notice.kind !== 'busy' && onNotice(null)}>
      {notice.text}
    </button>
  ) : null

  if (!store || !mapId) {
    return (
      <div className={styles.stage}>
        <p className={styles.empty}>{session.campaign.maps.length ? s.master.chooseMap : s.master.noMaps}</p>
        {bar}
      </div>
    )
  }
  return <Field session={session} mapId={mapId} store={store} preview={preview} tool={tool} brush={brush} bar={bar} onRoll={onRoll} onEngine={onEngine} live={explored} />
}

function Field({ session, mapId, store, preview, tool, brush, bar, onRoll, onEngine, live }: {
  session: CampaignSession
  mapId: string
  store: MapStore
  preview: boolean
  tool: MapTool
  brush: number
  bar: React.ReactNode
  onRoll: (entry: RollEntry) => void
  onEngine: (engine: MapEngine | null) => void
  live: { current: ExploredMask | null }
}) {
  const s = useStrings()
  const scene = useMapScene(store)
  const engine = useRef<MapEngine | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [dice, setDice] = useState(false)
  const plate = useRef<HTMLDivElement>(null)
  const players = session.campaign.players
  const settings = session.campaign.settings

  // what players have seen: kept by the game, saved in pauses of discovering
  const explored = useMemo(() => (scene.image ? new ExploredMask(scene.image, session.exploredOf(mapId)) : undefined),
    [mapId, store])
  useEffect(() => {
    if (!explored || preview) return
    live.current = explored
    let timer: ReturnType<typeof setTimeout> | null = null
    const save = () => {
      timer = null
      session.apply([{ doc: exploredKey(mapId), set: explored.save() }], { record: false })
    }
    const off = explored.subscribe(() => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(save, SAVE_EXPLORED_MS)
    })
    return () => {
      off()
      if (live.current === explored) live.current = null
      if (timer) {
        clearTimeout(timer)
        save()
      }
    }
  }, [explored, preview, session, mapId, live])

  // the tokens of the players follow their sheets; a removed player or companion leaves the map
  useEffect(() => {
    if (preview) return
    for (const t of scene.tokens) {
      if (t.kind !== 'player') continue
      const player = players.find((p) => p.id === (t.owner ?? t.id))
      const want = !player ? null : t.owner ? companionToken(player, session.seat(player.id)) : heroToken(player, session.seat(player.id))
      if (!want) store.dispatch({ type: 'token.remove', id: t.id })
      else {
        const patch = followSheet(t, want)
        if (patch) store.dispatch({ type: 'token.update', id: t.id, patch })
      }
    }
  })

  const view = useMemo<MapViewState>(
    () => ({ role: 'master', playerId: 'master', drawColor: 'master', tool: preview ? 'select' : tool, brush, campaignRules: settings }),
    [preview, tool, brush, settings]
  )

  useShortcuts('game', {
    remove: selected && !preview && scene.tokens.some((t) => t.id === selected)
      ? () => {
          store.dispatch({ type: 'token.remove', id: selected })
          setSelected(null)
        }
      : undefined
  })

  const dragIn = (token: Omit<Token, 'pin'>) => (e: ReactPointerEvent) => {
    e.preventDefault()
    engine.current?.dragToken(token, e.nativeEvent)
  }

  return (
    <div className={styles.stage}>
      {scene.image ? (
        <MapView store={store} tiles={repo.tiles} view={view} explored={explored} onSelect={setSelected}
          onEngine={(e) => {
            engine.current = e
            if (!preview) onEngine(e)
          }} />
      ) : (
        <p className={styles.empty}>{s.master.noImage}</p>
      )}

      <div ref={plate} className={styles.cluster}>
        <Plate edge={['left', 'bottom']} direction="row" className={styles.clusterPlate}>
          <GameMenuButton icon="dice" color="grey" label={s.player.nav.dice} open={dice} onClick={() => setDice(!dice)} />
          {players.map((p) => {
            const seat = session.seat(p.id)
            const hero = heroToken(p, seat)
            const companion = companionToken(p, seat)
            return (
              <span key={p.id} className={styles.playerTokens}>
                <IconButton variant="switch" label={s.master.tokenOf(hero.name)} disabled={preview || !scene.image}
                  icon={<PlayerIcon name="character.figure.avatar" color={p.color} />} onPointerDown={dragIn(hero)} />
                {companion && (
                  <IconButton variant="switch" label={s.master.companionOf(companion.name || hero.name)} disabled={preview || !scene.image} onPointerDown={dragIn(companion)}
                    icon={<span className={styles.companionIcon} style={{ color: `var(--flow-${p.color})` }}>{(companion.name || s.player.companionToken).charAt(0).toUpperCase()}</span>} />
                )}
              </span>
            )
          })}
        </Plate>
      </div>

      {bar}
      {dice && (
        <DiceWindow anchor={plate.current} above onClose={() => setDice(false)}
          onRoll={(r) => onRoll(rollEntry(s.master.name, 'master', r))} />
      )}
    </div>
  )
}
