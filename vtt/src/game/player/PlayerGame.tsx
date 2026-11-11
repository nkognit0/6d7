// The game of a player, opened by the code of a place (#/join/<code>, a new tab). Without the server
// the code is looked up among the campaigns of this browser, and the game is the master's game in
// another tab of the same browser: the master's tab keeps the sheet and the map. The first time the
// player makes the sheet («Начать игру»), then plays on the map. `#/join/<code>/stub` — the
// development map without the master (the sheet is written into the campaign directly).
import { useEffect, useMemo, useState } from 'react'
import { MAX_LEVEL } from '@app/levelup/read'
import { repo, seatKey, useSession, type CampaignSession, type CodeTarget } from '../../campaign'
import { useStrings } from '../../i18n'
import { Button, ConfirmDialog, TopPanel } from '../../ui'
import { emptySeat, type Seat } from '../seat/seat'
import { CharacterSheet } from '../sheet/CharacterSheet'
import { PlayerField } from './PlayerField'
import { useStubMap } from './stubMap'
import { useGuest } from './useGuest'
import { useNarrow } from '../inventory/narrow'
import { MoreMenu, SheetFiles } from './SeatWindow'
import { useSeatWizards } from './useSeatWizards'
import styles from './Player.module.css'

function Message({ text }: { text: string }) {
  const s = useStrings()
  return (
    <div className={styles.messageScreen}>
      <p>{text}</p>
      <a href="#/">{s.stub.home}</a>
    </div>
  )
}

export function PlayerGame({ code, stub }: { code: string; stub?: boolean }) {
  const s = useStrings()
  const [target, setTarget] = useState<CodeTarget | null | undefined>(undefined)
  useEffect(() => {
    let live = true
    setTarget(undefined)
    repo.findCode(code).then((t) => live && setTarget(t), () => live && setTarget(null))
    return () => {
      live = false
    }
  }, [code])
  if (target === undefined) return <div className={styles.start} />
  if (target === null) return <Message text={s.stub.joinUnknown} />
  return stub
    ? <StubSession key={target.campaign + target.player} campaignId={target.campaign} playerId={target.player} />
    : <Guest key={target.campaign + target.player} campaignId={target.campaign} playerId={target.player} />
}

/** In the master's game: the sheet and the map come from the master's tab. */
function Guest({ campaignId, playerId }: { campaignId: string; playerId: string }) {
  const s = useStrings()
  const { state, changeSeat, roll } = useGuest(campaignId, playerId)
  const joined = state.status === 'joined' ? state : null
  const seat = useMemo(() => joined?.seat ?? emptySeat(), [joined?.seat])
  if (state.status === 'connecting') return <div className={styles.start} />
  if (state.status === 'waiting') return <Message text={s.player.noMaster} />
  if (state.status === 'ended') return <Message text={s.player.masterLeft} />
  if (!joined) return <Message text={s.player.seatGone} />
  const player = joined.campaign.players.find((p) => p.id === playerId)
  if (!player) return <Message text={s.player.seatGone} />
  const map = joined.map && { store: joined.map.store, tiles: repo.tiles, explored: joined.map.explored }
  return seat.started
    ? <PlayerField player={player} seat={seat} onChange={changeSeat} settings={joined.campaign.settings} map={map} onRoll={roll} />
    : <SheetStart seat={seat} onChange={changeSeat} />
}

// the development map: the campaign of this browser, without the master
function StubSession({ campaignId, playerId }: { campaignId: string; playerId: string }) {
  const s = useStrings()
  const state = useSession(campaignId)
  if (state.status === 'loading') return <div className={styles.start} />
  if (state.status !== 'open') return <Message text={state.status === 'missing' ? s.campaign.notFound : s.campaign.storageFailed} />
  return <StubSeated session={state.session} playerId={playerId} />
}

function StubSeated({ session, playerId }: { session: CampaignSession; playerId: string }) {
  const s = useStrings()
  const player = session.campaign.players.find((p) => p.id === playerId)
  const stored = session.seat(playerId)
  const seat = useMemo(() => stored ?? emptySeat(), [stored])
  if (!player) return <Message text={s.player.seatGone} />
  // the seat belongs to the place: a sheet edited by its player is not undone in the editor
  const change = (next: Seat) => session.apply([{ doc: seatKey(playerId), set: next }], { record: false })
  return seat.started
    ? <StubField player={player} seat={seat} onChange={change} settings={session.campaign.settings} />
    : <SheetStart seat={seat} onChange={change} />
}

function StubField(props: Omit<Parameters<typeof PlayerField>[0], 'map' | 'own'>) {
  const s = useStrings()
  const map = useStubMap(s.player.stubMap)
  if (!map) return <div className={styles.field}><p className={styles.preparing}>{s.player.preparingMap}</p></div>
  return <PlayerField {...props} map={map} own />
}

/**
 * D&D VTT / game / player / start: the first entry — the sheet with «Создать лист», «Повысить
 * уровень», «Очистить», «Начать игру» and the sheet files. The game starts once the sheet has a
 * class and a level.
 */
function SheetStart({ seat, onChange }: { seat: Seat; onChange: (seat: Seat) => void }) {
  const s = useStrings()
  const wizards = useSeatWizards(seat, onChange)
  const [clearing, setClearing] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const narrow = useNarrow()
  const ready = wizards.level != null
  const levelUp = s.sheet.levelUp(Math.min(MAX_LEVEL, (wizards.level ?? 0) + 1))
  return (
    <div className={styles.start}>
      <TopPanel className={styles.top}
        left={
          <>
            <Button variant="primary" onClick={wizards.create}>{s.sheet.createSheet}</Button>
            {!narrow && (
              <>
                <Button variant="primary" disabled={!wizards.canLevelUp} onClick={wizards.levelUp}>{levelUp}</Button>
                <Button variant="secondary" onClick={() => setClearing(true)}>{s.sheet.clear}</Button>
              </>
            )}
            <Button disabled={!ready} title={ready ? undefined : s.player.startHint} onClick={() => onChange({ ...seat, started: true })}>{s.sheet.startGame}</Button>
          </>
        }
        right={narrow
          ? <MoreMenu items={[{ label: levelUp, run: wizards.levelUp, disabled: !wizards.canLevelUp }, { label: s.sheet.clear, run: () => setClearing(true) }]} files seat={seat} onChange={onChange} onMessage={setMessage} />
          : <SheetFiles seat={seat} onChange={onChange} onMessage={setMessage} />}
      />
      {message && <div className={styles.message} onClick={() => setMessage(null)}>{message}</div>}
      <div className={styles.scroll}>
        <CharacterSheet seat={seat} onChange={onChange} />
      </div>
      {clearing && (
        <ConfirmDialog text={s.sheet.clearConfirm} confirm={s.sheet.clear} cancel={s.common.cancel}
          onConfirm={() => {
            setClearing(false)
            onChange(emptySeat())
          }}
          onCancel={() => setClearing(false)} />
      )}
      {wizards.element}
    </div>
  )
}
