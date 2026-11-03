import { useEffect, useState } from 'react'
import type { CampaignSession, SavedNpc } from '../campaign'
import { useStrings } from '../i18n'
import { newId } from '../map'
import { matches, npcToken, searchTokens, tokenTexts, type NpcToken } from '../npc/catalog'
import {
  Button, ConfirmDialog, Icon, IconButton, NavTab, NpcCard, RowField, RowTabs, RowTitle, SearchInput, SidebarSection, Textarea, TextInput
} from '../ui'
import { rarityText } from './maps/MapPanel'
import styles from './NpcTab.module.css'

type Tab = 'catalog' | 'saved'
/** What the panel edits: a catalog token (a new NPC) or a saved NPC. */
type Choice = { kind: 'token'; id: string } | { kind: 'saved'; id: string }

/**
 * D&D VTT / editor / NPC (14:1274, 40:3926): the catalog of tokens and the saved NPCs of the
 * campaign; the panel on the right makes a token a unique NPC («Новый NPC») or changes a saved
 * one («Изменить NPC»).
 */
export function NpcTab({ session }: { session: CampaignSession }) {
  const s = useStrings()
  const t = s.editor.npc
  const [tab, setTab] = useState<Tab>('catalog')
  const [query, setQuery] = useState('')
  const [choice, setChoice] = useState<Choice | null>(null)
  const [deleting, setDeleting] = useState<SavedNpc | null>(null)
  const { npcs } = session.campaign

  const tokens = tab === 'catalog' ? searchTokens(query) : []
  const saved = tab === 'saved'
    ? npcs.filter((n) => {
        const c = npcToken(n.token)
        return matches(query, [...(c ? tokenTexts(c) : []), n.name, n.description])
      })
    : []

  // the first card is chosen while nothing (or something gone) is
  const ids = tab === 'catalog' ? tokens.map((x) => x.id) : saved.map((n) => n.id)
  const chosen = choice && choice.kind === (tab === 'catalog' ? 'token' : 'saved') && ids.includes(choice.id) ? choice : null
  useEffect(() => {
    if (!chosen && ids.length) setChoice({ kind: tab === 'catalog' ? 'token' : 'saved', id: ids[0] })
  })

  const savedNpc = chosen?.kind === 'saved' ? npcs.find((n) => n.id === chosen.id) : undefined
  const token = chosen ? npcToken(chosen.kind === 'token' ? chosen.id : (savedNpc?.token ?? '')) : undefined

  const save = (name: string, description: string) => {
    if (!token) return
    const npc: SavedNpc = { id: savedNpc?.id ?? newId(), token: token.id, name: name.trim() || token.name, description }
    session.apply([{ doc: 'campaign', op: { type: 'npc.put', npc } }])
    // a new NPC shows where it went: «Сохранённые», chosen
    if (!savedNpc) {
      setTab('saved')
      setQuery('')
      setChoice({ kind: 'saved', id: npc.id })
    }
  }

  const remove = (npc: SavedNpc) => {
    setDeleting(null)
    session.apply([{ doc: 'campaign', op: { type: 'npc.remove', id: npc.id } }])
  }

  const card = (key: string, c: NpcToken | undefined, name: string, note: string, selected: boolean, pick: () => void) => (
    <NpcCard key={key} image={c?.url ?? ''} name={name} note={note} selected={selected} onClick={pick} />
  )

  return (
    <div className={styles.layout}>
      <div className={styles.main}>
        <div className={styles.header}>
          <RowTabs>
            <NavTab selected={tab === 'catalog'} onClick={() => setTab('catalog')}>{t.catalog}</NavTab>
            <NavTab selected={tab === 'saved'} onClick={() => setTab('saved')}>{t.saved}</NavTab>
          </RowTabs>
          <SearchInput className={styles.search} value={query} placeholder={s.common.search} title={t.searchHint} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <div className={styles.grid}>
          {tab === 'catalog'
            ? tokens.map((c) => card(c.id, c, c.name, rarityText(c.id), chosen?.id === c.id, () => setChoice({ kind: 'token', id: c.id })))
            : saved.map((n) => card(n.id, npcToken(n.token), n.name, n.description.split('\n')[0] || rarityText(n.token), chosen?.id === n.id, () => setChoice({ kind: 'saved', id: n.id })))}
        </div>
        {!ids.length && <p className={styles.empty}>{tab === 'saved' && !npcs.length ? t.noSaved : s.common.nothingFound}</p>}
      </div>

      <aside className={styles.panel}>
        <SidebarSection className={styles.title}>
          <RowTitle title={savedNpc ? t.editNpc : t.newNpc} />
        </SidebarSection>
        {token && (
          <NpcForm
            key={`${chosen?.kind}:${chosen?.id}`}
            token={token}
            name={savedNpc?.name ?? token.name}
            description={savedNpc ? savedNpc.description : rarityText(token.id)}
            onSave={save}
            onDelete={savedNpc && (() => setDeleting(savedNpc))}
          />
        )}
      </aside>

      {deleting && (
        <ConfirmDialog
          text={t.deleteConfirm(deleting.name)}
          confirm={s.common.delete}
          cancel={s.common.cancel}
          onConfirm={() => remove(deleting)}
          onCancel={() => setDeleting(null)}
        />
      )}
    </div>
  )
}

/** The panel of one NPC: the big card, «Имя», «Описание», «Сохранить» (and deleting a saved one). */
function NpcForm({ token, name: initialName, description: initialDescription, onSave, onDelete }: {
  token: NpcToken
  name: string
  description: string
  onSave: (name: string, description: string) => void
  onDelete?: () => void
}) {
  const s = useStrings()
  const t = s.editor.npc
  const [name, setName] = useState(initialName)
  const [description, setDescription] = useState(initialDescription)
  return (
    <form
      className={styles.form}
      onSubmit={(e) => {
        e.preventDefault()
        onSave(name, description)
      }}
    >
      <SidebarSection className={styles.fields}>
        <NpcCard layout="preview" image={token.url} name={name.trim() || token.name} note={description.split('\n')[0] || rarityText(token.id)} />
        <RowField label={t.name}>
          <TextInput value={name} onChange={(e) => setName(e.target.value)} />
        </RowField>
        <RowField label={t.description} layout="stacked">
          <Textarea className={styles.description} value={description} onChange={(e) => setDescription(e.target.value)} />
        </RowField>
      </SidebarSection>
      <SidebarSection className={styles.save}>
        <div className={styles.actions}>
          <Button type="submit" stretch>{s.common.save}</Button>
          {onDelete && <IconButton label={t.deleteNpc} icon={<Icon name="minus" />} onClick={onDelete} />}
        </div>
      </SidebarSection>
    </form>
  )
}
