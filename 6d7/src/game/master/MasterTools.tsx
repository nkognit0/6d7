// The right panel of the master's game (57:3450): the fog brush and its eraser, the pencil and the
// eraser of lines, the conditions of the map in real time and the log of rolls at the bottom.
import type { CampaignSession } from '../../campaign'
import { useStrings } from '../../i18n'
import { rulesOf, useMapScene, type MapRules, type MapStore, type MapTool } from '../../map'
import { ColorIcon, Icon, IconButton, PlayerIcon, RowSubtitle, RowSwitch, SidebarSection, Slider } from '../../ui'
import { LogList, type RollEntry } from '../player/Dice'
import styles from './Master.module.css'

export function MasterTools({ session, mapId, tool, onTool, brush, onBrush, log }: {
  session: CampaignSession
  /** the map of the game; null while there is none or another map is looked at */
  mapId: string | null
  tool: MapTool
  onTool: (tool: MapTool) => void
  brush: number
  onBrush: (brush: number) => void
  log: RollEntry[]
}) {
  const store = mapId ? session.gameMap(mapId)?.store : undefined
  return (
    <aside className={styles.right}>
      {store ? <Live session={session} store={store} tool={tool} onTool={onTool} brush={brush} onBrush={onBrush} /> : <Panel tool={tool} onTool={onTool} brush={brush} onBrush={onBrush} />}
      <div className={styles.log}>
        <LogList entries={log} />
      </div>
    </aside>
  )
}

// the panel of a map of the game: it follows the scene
function Live({ session, store, ...rest }: { session: CampaignSession; store: MapStore; tool: MapTool; onTool: (tool: MapTool) => void; brush: number; onBrush: (brush: number) => void }) {
  const scene = useMapScene(store)
  const settings = session.campaign.settings
  const rules = rulesOf(scene, settings)
  // the same overrides as in the editor: the campaign's value drops the map's own
  const set = (rule: keyof MapRules, v: boolean) => {
    const own = rule === 'darkness' ? v || null : v === settings[rule as keyof typeof settings] ? null : v
    store.dispatch({ type: 'rules', patch: { [rule]: own } })
  }
  const eraseMine = () => store.dispatch({ type: 'draw.remove', ids: scene.drawings.filter((d) => d.author === 'master').map((d) => d.id) })
  return <Panel {...rest} rules={rules} onRule={set} onEraseMine={eraseMine} />
}

/** Without a map of the game the panel is there, inactive. */
function Panel({ tool, onTool, brush, onBrush, rules, onRule, onEraseMine }: {
  tool: MapTool
  onTool: (tool: MapTool) => void
  brush: number
  onBrush: (brush: number) => void
  rules?: MapRules
  onRule?: (rule: keyof MapRules, v: boolean) => void
  onEraseMine?: () => void
}) {
  const s = useStrings()
  const t = s.editor.maps
  const off = !rules
  const pick = (x: MapTool) => onTool(tool === x ? 'select' : x)
  return (
    <div className={styles.toolsBody}>
      <SidebarSection className={styles.frame}>
        <RowSubtitle>{s.master.fog}</RowSubtitle>
        <div className={styles.brush}>
          <IconButton variant="chat" disabled={off} pressed={!off && tool === 'fog-paint'} label={t.fogBrush} icon={<Icon name="fog.of.war" />} onClick={() => pick('fog-paint')} />
          <Slider value={brush} min={1} max={20} disabled={off} onChange={onBrush} aria-label={t.brushSize} />
          <IconButton variant="chat" disabled={off} pressed={!off && tool === 'fog-erase'} label={t.fogEraser} icon={<Icon name="eraser" />} onClick={() => pick('fog-erase')} />
        </div>
      </SidebarSection>

      <SidebarSection className={styles.frame}>
        <RowSubtitle>{s.master.drawing}</RowSubtitle>
        <div className={styles.drawing}>
          <IconButton variant="chat" stretch disabled={off} pressed={!off && tool === 'pencil'} label={s.master.pencil}
            icon={<PlayerIcon name="character.pencil" color="grey" />} onClick={() => pick('pencil')} />
          <IconButton variant="chat" stretch disabled={off} pressed={!off && tool === 'draw-erase'} label={`${s.master.eraser}. ${s.player.tools.eraserHint}`}
            icon={<ColorIcon name="character.eraser" />} onClick={() => pick('draw-erase')} onDoubleClick={onEraseMine} />
        </div>
      </SidebarSection>

      <SidebarSection fill className={styles.frame}>
        <RowSubtitle>{s.master.conditions}</RowSubtitle>
        <RowSwitch label={t.freeMovement} disabled={off} checked={!!rules?.freeMove} onChange={(v) => onRule?.('freeMove', v)} />
        {rules?.freeMove && <RowSwitch label={t.freeDoors} checked={rules.freeDoors} onChange={(v) => onRule?.('freeDoors', v)} />}
        <RowSwitch label={t.darkness} disabled={off} checked={!!rules?.darkness} onChange={(v) => onRule?.('darkness', v)} />
        <RowSwitch label={t.dynamicFog} disabled={off} checked={!!rules?.dynamicFog} onChange={(v) => onRule?.('dynamicFog', v)} />
      </SidebarSection>
    </div>
  )
}
