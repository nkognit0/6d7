import { useCallback, useEffect, useRef, useState } from 'react'
import { go } from '../app/route'
import { ARCHIVE_EXT, ArchiveError, freeName, importArchive, repo, type CampaignMeta } from '../campaign'
import { useStrings, type Catalog } from '../i18n'
import { Button, ConfirmDialog, Icon, IconButton, MenuItem, TopPanel, UserMenu } from '../ui'
import { CampaignTile } from './CampaignTile'
import { JoinDialog } from './JoinDialog'
import styles from './HomeScreen.module.css'

type Notice = { kind: 'busy' | 'error'; text: string } | null

function archiveMessage(e: unknown, s: Catalog): string {
  if (e instanceof ArchiveError) return e.code === 'version' ? s.campaign.archiveVersion : e.code === 'damaged' ? s.campaign.archiveDamaged : s.campaign.archiveFormat
  return s.campaign.storageFailed
}

/**
 * D&D VTT / home (17:1613): the user menu and «Присоединиться к игре» on top; the campaigns of
 * this browser as tiles, four in a row, with «Создать» and the archive import.
 */
export function HomeScreen() {
  const s = useStrings()
  const [campaigns, setCampaigns] = useState<CampaignMeta[] | null>(null)
  const [notice, setNotice] = useState<Notice>(null)
  const [joining, setJoining] = useState(false)
  const [renaming, setRenaming] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<CampaignMeta | null>(null)
  const file = useRef<HTMLInputElement>(null)

  const refresh = useCallback(() => {
    repo.list().then(setCampaigns, () => {
      setCampaigns([])
      setNotice({ kind: 'error', text: s.campaign.storageFailed })
    })
  }, [s])

  // another tab (the editor) may have changed the campaigns
  useEffect(() => {
    refresh()
    addEventListener('focus', refresh)
    return () => removeEventListener('focus', refresh)
  }, [refresh])

  const create = async () => {
    try {
      const id = await repo.create(freeName(s.campaign.newName, (campaigns ?? []).map((c) => c.name)))
      go({ page: 'editor', campaign: id, tab: 'maps' })
    } catch {
      setNotice({ kind: 'error', text: s.campaign.storageFailed })
    }
  }

  const importFile = async (f: File) => {
    setNotice({ kind: 'busy', text: s.home.importing })
    try {
      await importArchive(f)
      setNotice(null)
    } catch (e) {
      setNotice({ kind: 'error', text: archiveMessage(e, s) })
    }
    refresh()
  }

  const rename = async (id: string, name: string | null) => {
    setRenaming(null)
    if (!name) return
    setCampaigns((list) => list?.map((c) => (c.id === id ? { ...c, name } : c)) ?? null)
    await repo.rename(id, name).catch(() => setNotice({ kind: 'error', text: s.campaign.storageFailed }))
    refresh()
  }

  const remove = async (c: CampaignMeta) => {
    setDeleting(null)
    setCampaigns((list) => list?.filter((x) => x.id !== c.id) ?? null)
    await repo.remove(c.id).catch(() => setNotice({ kind: 'error', text: s.campaign.storageFailed }))
    refresh()
  }

  return (
    <div className={styles.screen}>
      <TopPanel
        className={styles.top}
        left={
          <UserMenu name={s.home.userName}>
            <MenuItem disabled>{s.userMenu.logout}</MenuItem>
          </UserMenu>
        }
        right={<Button variant="light-accent" className={styles.joinButton} onClick={() => setJoining(true)}>{s.home.joinGame}</Button>}
      />

      <main className={styles.main}>
        <div className={styles.header}>
          <h1 className={styles.title}>{s.home.campaigns}</h1>
          {notice && <p className={notice.kind === 'error' ? styles.error : styles.busy} role={notice.kind === 'error' ? 'alert' : 'status'}>{notice.text}</p>}
          <div className={styles.actions}>
            <Button className={styles.create} onClick={() => void create()}>{s.home.create}</Button>
            <IconButton label={s.home.import} icon={<Icon name="arrows.import" />} disabled={notice?.kind === 'busy'} onClick={() => file.current?.click()} />
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
          </div>
        </div>

        <div className={styles.scroll}>
          {campaigns?.length === 0 && <p className={styles.empty}>{s.home.noCampaigns}</p>}
          <div className={styles.grid}>
            {campaigns?.map((c) => (
              <CampaignTile
                key={c.id}
                meta={c}
                renaming={renaming === c.id}
                onPlay={() => go({ page: 'play', campaign: c.id })}
                onEdit={() => go({ page: 'editor', campaign: c.id, tab: 'maps' })}
                onRenameStart={() => setRenaming(c.id)}
                onRename={(name) => void rename(c.id, name)}
                onDelete={() => setDeleting(c)}
              />
            ))}
          </div>
        </div>
      </main>

      {joining && <JoinDialog onClose={() => setJoining(false)} />}
      {deleting && (
        <ConfirmDialog
          text={s.campaignMenu.deleteConfirm}
          confirm={s.common.delete}
          cancel={s.common.cancel}
          onConfirm={() => void remove(deleting)}
          onCancel={() => setDeleting(null)}
        />
      )}
    </div>
  )
}
