// The left panel of the master's game (44:1629, 44:2135): «Карты» and «NPC», the search; maps —
// the first click shows a map, the second moves the game there; NPCs are dragged onto the map.
import { useState, type PointerEvent as ReactPointerEvent } from 'react'
import type { CampaignSession } from '../../campaign'
import { useStrings } from '../../i18n'
import type { MapScene, Token } from '../../map'
import { matches, npcCards } from '../../npc/catalog'
import {
  ContextMenu, cx, Icon, IconButton, MenuItem, NavTab, NpcCard, RowCard, RowSwitch, RowTabs, SearchInput, SidebarSection, useContextMenu
} from '../../ui'
import styles from './Master.module.css'

type Tab = 'maps' | 'npc'

export function MasterMaps({ session, shown, active, onPick, onPlay, onLook, onDrag }: {
  session: CampaignSession
  /** the map on the field: the active one or one being looked at */
  shown: string | null
  active: string | null
  onPick: (id: string) => void
  onPlay: (id: string) => void
  onLook: (id: string) => void
  /** drags a token onto the field; missing while there is no game map on it */
  onDrag?: (token: Omit<Token, 'pin'>, e: PointerEvent) => void
}) {
  const s = useStrings()
  const [tab, setTab] = useState<Tab>('maps')
  const [query, setQuery] = useState('')
  const [catalog, setCatalog] = useState(true)
  const [menuFor, setMenuFor] = useState<string | null>(null)
  const menu = useContextMenu()

  const maps = session.campaign.maps.map((id) => session.map(id)?.get()).filter((m): m is MapScene => !!m)
  const shownMaps = maps.filter((m) => matches(query, [m.name]))
  const npcs = npcCards(session.campaign.npcs, catalog, query)
  const openMenu = (id: string, x: number, y: number) => {
    setMenuFor(id)
    menu.open({ preventDefault: () => {}, clientX: x, clientY: y })
  }
  // an NPC goes onto the map of the game only, not onto a map being looked at
  const dragIn = (make: () => Omit<Token, 'pin'>) => (e: ReactPointerEvent) => {
    e.preventDefault()
    onDrag?.(make(), e.nativeEvent)
  }

  return (
    <aside className={styles.left}>
      <SidebarSection>
        <RowTabs stretch>
          <NavTab selected={tab === 'maps'} onClick={() => setTab('maps')}>{s.master.resources.maps}</NavTab>
          <NavTab selected={tab === 'npc'} onClick={() => setTab('npc')}>{s.master.resources.npc}</NavTab>
        </RowTabs>
      </SidebarSection>
      <SidebarSection>
        {tab === 'npc' && <RowSwitch label={s.master.showCatalog} checked={catalog} onChange={setCatalog} />}
        <SearchInput value={query} placeholder={s.common.search} onChange={(e) => setQuery(e.target.value)} />
      </SidebarSection>

      {tab === 'maps' && (
        <SidebarSection className={styles.list}>
          {shownMaps.map((m) => (
            <RowCard
              key={m.id}
              selected={m.id === shown}
              onClick={() => onPick(m.id)}
              onContextMenu={(e) => {
                e.preventDefault()
                openMenu(m.id, e.clientX, e.clientY)
              }}
              actions={
                <>
                  {m.id === active && <span className={styles.activeMark} title={s.master.activeMap}><Icon name="play" /></span>}
                  <IconButton label={s.master.mapActions} icon={<Icon name="more.three.dots" />}
                    onClick={(e) => {
                      e.stopPropagation()
                      const r = e.currentTarget.getBoundingClientRect()
                      openMenu(m.id, r.left, r.bottom)
                    }} />
                </>
              }
            >
              {m.name || s.editor.maps.untitled}
            </RowCard>
          ))}
          {!maps.length && <p className={styles.note}>{s.master.noMaps}</p>}
          {maps.length > 0 && !shownMaps.length && <p className={styles.note}>{s.common.nothingFound}</p>}
        </SidebarSection>
      )}

      {tab === 'npc' && (
        <SidebarSection fill className={styles.npcSection}>
          <div className={styles.npcList}>
            {npcs.map((n) => (
              <NpcCard key={n.key} layout="list" image={n.image} name={n.name} note={n.note} className={cx(styles.dragCard, !onDrag && styles.inactive)}
                onPointerDown={onDrag ? dragIn(n.token) : undefined} />
            ))}
            {!npcs.length && <p className={styles.note}>{!catalog && !query && !session.campaign.npcs.length ? s.editor.maps.noNpc : s.common.nothingFound}</p>}
          </div>
        </SidebarSection>
      )}

      <ContextMenu at={menu.at} onClose={menu.close}>
        <MenuItem disabled={menuFor === shown} onClick={() => menuFor && onLook(menuFor)}>{s.master.look}</MenuItem>
        <MenuItem disabled={menuFor === active} onClick={() => menuFor && onPlay(menuFor)}>{s.master.playHere}</MenuItem>
      </ContextMenu>
    </aside>
  )
}
