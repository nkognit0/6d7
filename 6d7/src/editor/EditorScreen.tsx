import { useRef, useState, type ReactNode } from 'react'
import { go, type EditorTab } from '../app/route'
import { shortcutLabel, useShortcuts } from '../app/shortcuts'
import { archiveMessage } from '../app/archiveMessage'
import { ARCHIVE_EXT, downloadArchive, importInto, repo, useSession, type CampaignSession } from '../campaign'
import { useStrings } from '../i18n'
import {
  BottomNavigation, ConfirmDialog, Icon, Icon28, InlineEdit, MenuDivider, MenuItem, ModeSwitch, NavPage, ProjectMenu, TopPanel, UserMenu,
  type Icon28Name
} from '../ui'
import { MapsTab } from './maps/MapsTab'
import { NpcTab } from './NpcTab'
import { PlayersTab } from './PlayersTab'
import { SettingsTab } from './SettingsTab'
import styles from './EditorScreen.module.css'

const TABS: [EditorTab, Icon28Name][] = [['maps', 'map'], ['npc', 'autointent'], ['players', 'person.human.avatar'], ['settings', 'settings']]

/** «Редактирование» or the map as the players see it (the map tab, step 4). */
export type EditorMode = 'edit' | 'player'

type Notice = { kind: 'busy' | 'error'; text: string } | null

/** A message in place of the editor: a missing campaign, a refused storage. */
function Message({ text }: { text: string }) {
  const s = useStrings()
  return (
    <div className={styles.message}>
      <p>{text}</p>
      <a href="#/">{s.stub.home}</a>
    </div>
  )
}

/**
 * D&D VTT / editor (0:1): the campaign menu and the mode switch on top, the page of the tab in
 * the middle, the tabs «Карты», «NPC», «Игроки», «Параметры» at the bottom.
 */
export function EditorScreen({ campaignId, tab, map }: { campaignId: string; tab: EditorTab; map?: string }) {
  const s = useStrings()
  const state = useSession(campaignId)
  if (state.status === 'loading') return <div className={styles.screen} />
  if (state.status === 'missing') return <Message text={s.campaign.notFound} />
  if (state.status === 'failed') return <Message text={s.campaign.storageFailed} />
  return <Editor session={state.session} tab={tab} map={map} />
}

function Editor({ session, tab, map }: { session: CampaignSession; tab: EditorTab; map?: string }) {
  const s = useStrings()
  const [mode, setMode] = useState<EditorMode>('edit')
  const [renaming, setRenaming] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [notice, setNotice] = useState<Notice>(null)
  const file = useRef<HTMLInputElement>(null)
  const campaign = session.campaign

  useShortcuts('editor', { undo: () => session.undo(), redo: () => session.redo() })

  const rename = (name: string | null) => {
    setRenaming(false)
    if (name) session.apply([{ doc: 'campaign', op: { type: 'rename', name } }])
  }

  const importFile = async (f: File) => {
    setNotice({ kind: 'busy', text: s.home.importing })
    try {
      await importInto(session, f)
      setNotice(null)
    } catch (e) {
      setNotice({ kind: 'error', text: archiveMessage(e, s) })
    }
  }

  const remove = async () => {
    setDeleting(false)
    await session.discard()
    await repo.remove(session.id)
    go({ page: 'home' }, { replace: true })
  }

  const pages: Record<EditorTab, ReactNode> = {
    maps: <MapsTab session={session} mode={mode} mapId={map} />,
    npc: <NpcTab session={session} />,
    players: <PlayersTab session={session} />,
    settings: <SettingsTab session={session} />
  }

  return (
    <div className={styles.screen}>
      <TopPanel
        left={
          renaming ? (
            <div className={styles.rename}>
              <InlineEdit value={campaign.name} aria-label={s.campaign.nameField} onDone={rename} />
            </div>
          ) : (
            <ProjectMenu title={campaign.name}>
              <MenuItem hint={shortcutLabel('undo')} disabled={!session.history.canUndo} onClick={() => session.undo()}>{s.campaignMenu.undo}</MenuItem>
              <MenuItem hint={shortcutLabel('redo')} disabled={!session.history.canRedo} onClick={() => session.redo()}>{s.campaignMenu.redo}</MenuItem>
              <MenuDivider />
              <MenuItem onClick={() => void session.save()}>{s.campaignMenu.save}</MenuItem>
              <MenuItem onClick={() => void downloadArchive(session.docs())}>{s.campaignMenu.export}</MenuItem>
              <MenuItem disabled={notice?.kind === 'busy'} onClick={() => file.current?.click()}>{s.campaignMenu.import}</MenuItem>
              <MenuItem onClick={() => setRenaming(true)}>{s.common.rename}</MenuItem>
              <MenuDivider />
              <MenuItem onClick={() => go({ page: 'home' })}>{s.campaignMenu.toHome}</MenuItem>
              <MenuItem onClick={() => setDeleting(true)}>{s.campaignMenu.delete}</MenuItem>
            </ProjectMenu>
          )
        }
        center={
          notice && (
            <button type="button" className={notice.kind === 'error' ? styles.error : styles.busy} onClick={() => notice.kind === 'error' && setNotice(null)}>
              {notice.text}
            </button>
          )
        }
        right={
          <>
            {tab === 'maps' && (
              <ModeSwitch
                value={mode}
                onChange={setMode}
                options={[
                  { value: 'edit', label: s.editor.modeEdit, icon: <Icon name="edit" /> },
                  { value: 'player', label: s.editor.modePlayerView, icon: <Icon name="play" /> }
                ]}
              />
            )}
            {/* the user menu has no items yet (app-description: options will come later) */}
            <UserMenu name={s.home.userName} showName={false} align="end" />
          </>
        }
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

      <main className={styles.main}>{pages[tab]}</main>

      <BottomNavigation>
        {TABS.map(([t, icon]) => (
          <NavPage key={t} icon={<Icon28 name={icon} />} selected={tab === t} onClick={() => go({ page: 'editor', campaign: session.id, tab: t })}>
            {s.editor.nav[t]}
          </NavPage>
        ))}
      </BottomNavigation>

      {deleting && (
        <ConfirmDialog
          text={s.campaignMenu.deleteConfirm}
          confirm={s.common.delete}
          cancel={s.common.cancel}
          onConfirm={() => void remove()}
          onCancel={() => setDeleting(false)}
        />
      )}
    </div>
  )
}
