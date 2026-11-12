// The game of the master (D&D VTT / game / master 44:1629, #/c/<id>/play): the campaign menu, the
// players and «Отдых» on top; maps and NPCs on the left; the map with the dice and the tokens of
// the players; fog, drawing, conditions and the log on the right. The master can do whatever a
// player does on the player's pages.
import { useEffect, useRef, useState } from 'react'
import { longRest, shortRest } from '@app/rest/rest'
import { archiveMessage } from '../../app/archiveMessage'
import { go } from '../../app/route'
import { ARCHIVE_EXT, downloadGame, importGameInto, seatKey, useSession, type CampaignSession, type Change, type PlayerSlot } from '../../campaign'
import { useStrings } from '../../i18n'
import type { ExploredMask, MapEngine, MapTool } from '../../map'
import { Button, GameMenuButton, Menu, MenuDivider, MenuItem, Plate, Popover, ProjectMenu, TopPanel, type PlayerIcon42Name } from '../../ui'
import { characterOf, emptySeat, withCharacter, type Seat } from '../seat/seat'
import { rollEntry, type RollEntry } from '../player/Dice'
import { SeatWindow, type SeatPage } from '../player/SeatWindow'
import { useSeatWizards } from '../player/useSeatWizards'
import { MasterField } from './MasterField'
import { MasterMaps } from './MasterMaps'
import { MasterTools } from './MasterTools'
import { activateMap, startGame } from './start'
import { useHost } from './useHost'
import styles from './Master.module.css'

const PAGES: [SeatPage, PlayerIcon42Name][] = [['sheet', 'sheet.character'], ['companion', 'sheet.sidekick'], ['items', 'inventory'], ['spells', 'spells']]

/** A line over the map: the result of a rest, an import going on or failed. A click hides it. */
export type Notice = { kind: 'info' | 'busy' | 'error'; text: string } | null

function Message({ text }: { text: string }) {
  const s = useStrings()
  return (
    <div className={styles.message}>
      <p>{text}</p>
      <a href="#/">{s.stub.home}</a>
    </div>
  )
}

export function MasterGame({ campaignId }: { campaignId: string }) {
  const s = useStrings()
  const state = useSession(campaignId)
  if (state.status === 'loading') return <div className={styles.screen} />
  if (state.status === 'missing') return <Message text={s.campaign.notFound} />
  if (state.status === 'failed') return <Message text={s.campaign.storageFailed} />
  return <Launch session={state.session} />
}

// the game takes the editor's edits once, when it starts (and again after a state is imported)
function Launch({ session }: { session: CampaignSession }) {
  const [started, setStarted] = useState(0)
  const [run, setRun] = useState(0)
  useEffect(() => {
    startGame(session)
    setStarted(run + 1)
  }, [session, run])
  if (started !== run + 1) return <div className={styles.screen} />
  return <Master key={run} session={session} onRestart={() => setRun(run + 1)} />
}

function Master({ session, onRestart }: { session: CampaignSession; onRestart: () => void }) {
  const s = useStrings()
  const [preview, setPreview] = useState<string | null>(null)
  const [pagesOf, setPagesOf] = useState<string | null>(null)
  const [open, setOpen] = useState<{ player: string; page: SeatPage } | null>(null)
  const [notice, setNotice] = useState<Notice>(null)
  const [log, setLog] = useState<RollEntry[]>([])
  const [tool, setTool] = useState<MapTool>('select')
  const [brush, setBrush] = useState(4)
  // the engine of the map of the game: NPCs are dragged onto it
  const [engine, setEngine] = useState<MapEngine | null>(null)
  // what players have seen on the map of the game, as its field shows it now
  const explored = useRef<ExploredMask | null>(null)
  const file = useRef<HTMLInputElement>(null)
  const campaign = session.campaign
  const active = session.gameDoc?.active ?? null
  // a map the editor deleted while previewed
  const previewing = preview && preview !== active && campaign.maps.includes(preview) ? preview : null
  const shown = previewing ?? active

  // the players' tabs play in this game; their rolls come into the log
  useHost(session, explored, {
    onRoll: (id, roll) => {
      const p = session.campaign.players.find((x) => x.id === id)
      if (p) setLog((l) => [...l, rollEntry(p.name || String(session.seat(id)?.sheet.name || ''), p.color, roll)])
    }
  })

  // first click — a look at the map, second — the game goes there; a click on the active map ends the look
  const pick = (id: string) => {
    if (id === active) setPreview(null)
    else if (id === previewing) play(id)
    else setPreview(id)
  }
  const play = (id: string) => {
    activateMap(session, id)
    setPreview(null)
    setTool('select')
  }

  const importFile = async (f: File) => {
    setNotice({ kind: 'busy', text: s.master.importing })
    try {
      await importGameInto(session, f)
      setNotice(null)
      onRestart()
    } catch (e) {
      setNotice({ kind: 'error', text: archiveMessage(e, s) })
    }
  }

  return (
    <div className={styles.screen}>
      <TopPanel
        left={
          <ProjectMenu title={campaign.name}>
            <MenuItem onClick={() => void session.save()}>{s.campaignMenu.save}</MenuItem>
            <MenuItem onClick={() => void downloadGame(session.docs(), s.master.gameFile)}>{s.campaignMenu.exportGame}</MenuItem>
            <MenuItem disabled={notice?.kind === 'busy'} onClick={() => file.current?.click()}>{s.campaignMenu.importGame}</MenuItem>
            <MenuDivider />
            <MenuItem onClick={() => go({ page: 'home' })}>{s.campaignMenu.toHome}</MenuItem>
          </ProjectMenu>
        }
        center={
          <div className={styles.players}>
            {campaign.players.map((p) => (
              <PlayerButton key={p.id} player={p} open={pagesOf === p.id} onToggle={() => setPagesOf(pagesOf === p.id ? null : p.id)}
                onPage={(page) => setOpen({ player: p.id, page })} current={open?.player === p.id ? open.page : null} />
            ))}
          </div>
        }
        right={<RestAll session={session} onDone={(text) => setNotice({ kind: 'info', text })} />}
      />
      <input
        ref={file}
        type="file"
        accept={ARCHIVE_EXT}
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0]
          e.target.value = ''
          if (f) void importFile(f)
        }}
      />

      <main className={styles.layout}>
        <MasterMaps session={session} shown={shown} active={active} onPick={pick} onPlay={play} onLook={(id) => setPreview(id === active ? null : id)}
          onDrag={engine && !previewing ? (token, e) => engine.dragToken(token, e) : undefined} />
        <MasterField
          key={shown ?? ''}
          session={session}
          mapId={shown}
          preview={!!previewing}
          tool={tool}
          brush={brush}
          notice={notice}
          onNotice={setNotice}
          onBack={active ? () => setPreview(null) : undefined}
          onRoll={(entry) => setLog((l) => [...l, entry])}
          onEngine={setEngine}
          explored={explored}
        />
        <MasterTools session={session} mapId={previewing ? null : active} tool={tool} onTool={setTool} brush={brush} onBrush={setBrush} log={log} />
      </main>

      {open && <PlayerPage session={session} player={open.player} page={open.page} onClose={() => setOpen(null)} />}
    </div>
  )
}

/**
 * A player in the top panel: dark blue, in the player's color while the menu of the player's pages
 * is open under it (45:5608).
 */
function PlayerButton({ player, open, current, onToggle, onPage }: {
  player: PlayerSlot
  open: boolean
  current: SeatPage | null
  onToggle: () => void
  onPage: (page: SeatPage) => void
}) {
  const s = useStrings()
  const label: Record<SeatPage, string> = { sheet: s.player.nav.sheet, companion: s.player.nav.companion, items: s.player.nav.inventory, spells: s.player.nav.spells }
  return (
    <div className={styles.playerAnchor}>
      <Button variant="light-accent" aria-expanded={open} title={s.master.pagesOf(player.name)} style={open ? { background: `var(--flow-${player.color})` } : undefined}
        onClick={onToggle}>
        {player.name || '—'}
      </Button>
      {open && (
        <Plate direction="row" className={styles.pages}>
          {PAGES.map(([page, icon]) => (
            <GameMenuButton key={page} icon={icon} color={player.color} label={label[page]} open={current === page} onClick={() => onPage(page)} />
          ))}
        </Plate>
      )}
    </div>
  )
}

/** A page of a player: the same window the player has, over the whole screen. */
function PlayerPage({ session, player, page, onClose }: { session: CampaignSession; player: string; page: SeatPage; onClose: () => void }) {
  const seat = session.seat(player) ?? emptySeat()
  // the seat belongs to the player: its edits are saved, not undone
  const change = (next: Seat) => session.apply([{ doc: seatKey(player), set: next }], { record: false })
  const wizards = useSeatWizards(seat, change)
  return (
    <>
      <SeatWindow page={page} seat={seat} onChange={change} wizards={wizards} onClose={onClose} />
      {wizards.element}
    </>
  )
}

/** «Отдых» for all players at once: every sheet rests by the rules; what changed is told over the map. */
function RestAll({ session, onDone }: { session: CampaignSession; onDone: (text: string) => void }) {
  const s = useStrings()
  const [open, setOpen] = useState(false)
  const rest = (kind: 'short' | 'long') => {
    setOpen(false)
    const changes: Change[] = []
    const lines: string[] = []
    for (const p of session.campaign.players) {
      const seat = session.seat(p.id)
      if (!seat) continue
      const c = characterOf(seat)
      const r = kind === 'long' ? longRest(c) : shortRest(c, [])
      changes.push({ doc: seatKey(p.id), set: withCharacter(seat, r.character) })
      lines.push(s.master.restOf(p.name || String(seat.sheet.name || ''), r.changes.join(', ') || s.master.restNothing))
    }
    session.apply(changes, { record: false })
    onDone(lines.length ? lines.join(' · ') : s.master.restNobody)
  }
  return (
    <div className={styles.anchor}>
      <Button variant="primary" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)}>{s.master.rest}</Button>
      <Popover open={open} align="end" onClose={() => setOpen(false)}>
        <Menu>
          <MenuItem onClick={() => rest('short')}>{s.rest.short}</MenuItem>
          <MenuItem onClick={() => rest('long')}>{s.rest.long}</MenuItem>
        </Menu>
      </Popover>
    </div>
  )
}
