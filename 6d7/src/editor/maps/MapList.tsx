import { useState } from 'react'
import { freeName, mapKey, type CampaignSession } from '../../campaign'
import { matches } from '../../npc/catalog'
import { createScene, type MapScene } from '../../map'
import { useStrings } from '../../i18n'
import {
  ConfirmDialog, ContextMenu, Icon, IconButton, InlineEdit, MenuItem, RowCard, SearchInput, SidebarSection, SidebarTitle, useContextMenu,
  type MenuPoint
} from '../../ui'
import styles from './Maps.module.css'

/**
 * D&D VTT / editor / maps (6:424): the maps of the campaign — search, «+», the chosen map; «…» and
 * the right button open «Переименовать» and «Удалить».
 */
export function MapList({ session, selected, onSelect }: { session: CampaignSession; selected: string | null; onSelect: (id: string) => void }) {
  const s = useStrings()
  const t = s.editor.maps
  const [query, setQuery] = useState('')
  const [renaming, setRenaming] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<MapScene | null>(null)
  const [menuFor, setMenuFor] = useState<string | null>(null)
  const menu = useContextMenu()

  const maps = session.campaign.maps.map((id) => session.map(id)?.get()).filter((m): m is MapScene => !!m)
  const shown = maps.filter((m) => matches(query, [m.name]))

  const create = () => {
    const scene = createScene(freeName(t.newMap, maps.map((m) => m.name)))
    session.apply([{ doc: mapKey(scene.id), set: scene }, { doc: 'campaign', op: { type: 'map.add', id: scene.id } }])
    setQuery('')
    onSelect(scene.id)
  }

  const rename = (id: string, name: string | null) => {
    setRenaming(null)
    if (name) session.apply([{ doc: mapKey(id), op: { type: 'name', name } }])
  }

  const remove = (m: MapScene) => {
    setDeleting(null)
    session.apply([{ doc: 'campaign', op: { type: 'map.remove', id: m.id } }, { doc: mapKey(m.id), drop: true }])
  }

  const openMenu = (id: string, at: MenuPoint) => {
    setMenuFor(id)
    menu.open({ preventDefault: () => {}, clientX: at.x, clientY: at.y })
  }

  return (
    <aside className={styles.left}>
      <SidebarTitle title={t.title}>
        <div className={styles.search}>
          <SearchInput value={query} placeholder={s.common.search} onChange={(e) => setQuery(e.target.value)} />
          <IconButton label={t.newMap} icon={<Icon name="plus" />} onClick={create} />
        </div>
      </SidebarTitle>
      {shown.length > 0 && (
        <SidebarSection className={styles.mapList}>
          {shown.map((m) => (
            <RowCard
              key={m.id}
              selected={m.id === selected}
              onClick={() => onSelect(m.id)}
              onContextMenu={(e) => {
                e.preventDefault()
                openMenu(m.id, { x: e.clientX, y: e.clientY })
              }}
              actions={
                <IconButton
                  label={t.mapActions}
                  icon={<Icon name="more.three.dots" />}
                  onClick={(e) => {
                    const r = e.currentTarget.getBoundingClientRect()
                    openMenu(m.id, { x: r.left, y: r.bottom })
                  }}
                />
              }
            >
              {renaming === m.id ? <InlineEdit value={m.name} aria-label={t.title} onDone={(name) => rename(m.id, name)} /> : m.name || t.untitled}
            </RowCard>
          ))}
        </SidebarSection>
      )}
      <ContextMenu at={menu.at} onClose={menu.close}>
        <MenuItem onClick={() => setRenaming(menuFor)}>{s.common.rename}</MenuItem>
        <MenuItem onClick={() => setDeleting(maps.find((m) => m.id === menuFor) ?? null)}>{s.common.delete}</MenuItem>
      </ContextMenu>
      {deleting && (
        <ConfirmDialog
          text={t.deleteMapConfirm(deleting.name || t.untitled)}
          confirm={s.common.delete}
          cancel={s.common.cancel}
          onConfirm={() => remove(deleting)}
          onCancel={() => setDeleting(null)}
        />
      )}
    </aside>
  )
}
