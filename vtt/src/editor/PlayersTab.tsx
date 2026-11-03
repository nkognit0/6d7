import { useEffect, useState } from 'react'
import { MAX_PLAYERS, newPlayer, repo, seatKey, type CampaignSession, type Change, type PlayerSlot } from '../campaign'
import { useStrings } from '../i18n'
import { Avatar, Button, ConfirmDialog, Icon, IconButton, InviteCode, PlayerRow, TextInput } from '../ui'
import { TabPage } from './TabPage'
import styles from './EditorScreen.module.css'

/**
 * D&D VTT / editor / players (14:1481): up to eight players, each with a name, a color of its own
 * and a code. Until invitations exist the code is a stub of this browser.
 */
export function PlayersTab({ session }: { session: CampaignSession }) {
  const s = useStrings()
  const t = s.editor.players
  const { players } = session.campaign
  const [codes, setCodes] = useState<Record<string, string>>({})
  const [fresh, setFresh] = useState<string | null>(null)
  const [removing, setRemoving] = useState<PlayerSlot | null>(null)

  // a new player gets a code, an imported campaign — new codes for everybody
  useEffect(() => {
    let live = true
    repo.codes(session.id, players.map((p) => p.id)).then((c) => live && setCodes(c), () => {})
    return () => {
      live = false
    }
  }, [session.id, players])

  const add = () => {
    const player = newPlayer(session.campaign)
    if (!player) return
    session.apply([{ doc: 'campaign', op: { type: 'player.add', player } }])
    setFresh(player.id)
  }

  // the sheet of the player goes with the place
  const remove = (player: PlayerSlot) => {
    setRemoving(null)
    const changes: Change[] = [{ doc: 'campaign', op: { type: 'player.remove', id: player.id } }]
    if (session.seat(player.id)) changes.push({ doc: seatKey(player.id), drop: true })
    session.apply(changes)
  }

  return (
    <TabPage
      title={
        <>
          {t.title}
          <span className={styles.count}>{t.count(players.length, MAX_PLAYERS)}</span>
        </>
      }
      action={
        <Button className={styles.newPlayer} disabled={players.length >= MAX_PLAYERS} onClick={add}>{t.newPlayer}</Button>
      }
    >
      <div className={styles.players}>
        {players.map((p) => (
          <PlayerRow
            key={p.id}
            avatar={<Avatar name={p.name || '?'} color={p.color} />}
            name={
              <TextInput
                value={p.name}
                placeholder={t.namePlaceholder}
                aria-label={t.namePlaceholder}
                autoFocus={fresh === p.id}
                onChange={(e) => session.apply([{ doc: 'campaign', op: { type: 'player.update', id: p.id, patch: { name: e.target.value } } }])}
              />
            }
            code={codes[p.id] && <InviteCode code={codes[p.id]} />}
            action={<IconButton label={t.removePlayer} icon={<Icon name="minus" />} onClick={() => setRemoving(p)} />}
          />
        ))}
      </div>
      {removing && (
        <ConfirmDialog
          text={t.removeConfirm(removing.name.trim())}
          confirm={s.common.delete}
          cancel={s.common.cancel}
          onConfirm={() => remove(removing)}
          onCancel={() => setRemoving(null)}
        />
      )}
    </TabPage>
  )
}
