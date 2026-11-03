import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { repo, type CampaignSession, type CampaignSettings } from '../../campaign'
import { putMedia } from '../../game/media/media'
import { useStrings } from '../../i18n'
import {
  importMapImage, MAP_IMAGE_ACCEPT, MapImageError, MAX_IMAGE_SIDE, newId, rulesOf, type ImportProgress, type MapEngine, type MapOp, type MapRules,
  type MapScene, type MapTool, type Token, type ZoomInfo
} from '../../map'
import { matches, npcToken, searchTokens, tokenTexts } from '../../npc/catalog'
import {
  Button, cx, Icon, IconButton, NpcCard, NumberField, RowSubtitle, RowSwitch, SearchInput, SidebarSection, SidebarTitle, Slider
} from '../../ui'
import styles from './Maps.module.css'

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/** The rarity of a catalog token as the panel writes it: «Простой». */
export const rarityText = (tokenId: string) => cap(npcToken(tokenId)?.rarityRu ?? '')

/**
 * A condition of the map that follows the campaign until the map changes it (QnA): switching it
 * to the campaign's value drops the override; an override is marked «Только для этой карты ·
 * Вернуть».
 */
function RuleRow({ label, rule, scene, campaign, onPatch }: {
  label: string
  rule: keyof CampaignSettings
  scene: MapScene
  campaign: CampaignSettings
  onPatch: (patch: { [K in keyof MapRules]?: boolean | null }) => void
}) {
  const t = useStrings().editor.maps
  const value = rulesOf(scene, campaign)[rule]
  const own = scene.rules[rule] !== undefined
  return (
    <div className={styles.rule}>
      <RowSwitch label={label} checked={value} onChange={(v) => onPatch({ [rule]: v === campaign[rule] ? null : v })} />
      {own && (
        <span className={styles.override}>
          {t.onlyThisMap} ·{' '}
          <button type="button" className={styles.revert} title={t.revertHint} onClick={() => onPatch({ [rule]: null })}>{t.revert}</button>
        </span>
      )}
    </div>
  )
}

/**
 * D&D VTT / editor / maps (9:679): zoom, the picture, the grid, objects, fog, conditions, NPCs to
 * drag onto the map and «Сохранить». Without a picture — only the zoom, the upload and saving.
 */
export function MapPanel({ session, scene, dispatch, engine, zoom, tool, onTool, brush, onBrush }: {
  session: CampaignSession
  scene: MapScene | null
  dispatch: (op: MapOp) => void
  engine: MapEngine | null
  zoom: ZoomInfo | null
  tool: MapTool
  onTool: (tool: MapTool) => void
  brush: number
  onBrush: (brush: number) => void
}) {
  const s = useStrings()
  const t = s.editor.maps
  const [zoomText, setZoomText] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [catalog, setCatalog] = useState(true)
  const [query, setQuery] = useState('')
  const file = useRef<HTMLInputElement>(null)
  const settings = session.campaign.settings
  const pick = (x: MapTool) => onTool(tool === x ? 'select' : x)
  const image = scene?.image ?? null

  const commitZoom = () => {
    const n = Number(zoomText?.replace(',', '.').replace('%', ''))
    if (zoomText !== null && Number.isFinite(n) && n > 0) engine?.zoomTo(n)
    setZoomText(null)
  }

  const progress: ImportProgress = (stage, f) => setBusy(stage === 'tiles' ? t.imageCutting(Math.round(f * 100)) : t.imageReading)

  // the picture is cut into tiles in the browser's store; the file and the smallest level go to the media store
  const upload = async (f: File) => {
    setError(null)
    setBusy(t.imageReading)
    try {
      const img = await importMapImage(f, repo.tiles, progress)
      const [original, preview] = await Promise.all([img.original ? putMedia(img.original) : undefined, putMedia(img.thumbnail)])
      dispatch({ type: 'image', image: { ...img.info, original, preview } })
    } catch (e) {
      const code = e instanceof MapImageError ? e.code : 'other'
      setError(code === 'format' ? t.imageErrFormat : code === 'decode' ? t.imageErrDecode : code === 'size' ? t.imageErrSize(MAX_IMAGE_SIDE) : t.imageErrDecode)
    } finally {
      setBusy(null)
    }
  }

  // NPCs: the catalog, or (catalog off) the saved NPCs of the master
  const npcs = catalog
    ? searchTokens(query).map((c) => ({ key: c.id, image: c.url, name: c.name, note: cap(c.rarityRu), token: (): Omit<Token, 'pin'> => ({ id: newId(), kind: 'npc', name: c.name, image: c.url, token: c.id }) }))
    : session.campaign.npcs
        .filter((n) => {
          const c = npcToken(n.token)
          return matches(query, [...(c ? tokenTexts(c) : []), n.name, n.description])
        })
        .map((n) => ({ key: n.id, image: npcToken(n.token)?.url ?? '', name: n.name, note: n.description.split('\n')[0] || rarityText(n.token), token: (): Omit<Token, 'pin'> => ({ id: newId(), kind: 'npc', name: n.name, image: npcToken(n.token)?.url, token: n.token, saved: n.id }) }))

  const dragIn = (make: () => Omit<Token, 'pin'>) => (e: ReactPointerEvent) => {
    e.preventDefault()
    engine?.dragToken(make(), e.nativeEvent)
  }

  return (
    <aside className={styles.right}>
      <div className={styles.rightBody}>
        <SidebarTitle
            title={t.editing}
            action={
              <span className={styles.zoom}>
                <IconButton label={t.zoomOut} icon={<Icon name="minus" />} disabled={!zoom || zoom.percent <= zoom.min + 0.05} onClick={() => engine?.zoomBy(0.5)} />
                <input
                  className={styles.zoomInput}
                  aria-label={t.zoomField}
                  disabled={!zoom}
                  value={zoomText ?? (zoom ? `${Math.round(zoom.percent)}%` : '')}
                  onChange={(e) => setZoomText(e.target.value)}
                  onFocus={(e) => e.target.select()}
                  onBlur={commitZoom}
                  onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                />
                <IconButton label={t.zoomIn} icon={<Icon name="plus" />} disabled={!zoom || zoom.percent >= zoom.max - 0.05} onClick={() => engine?.zoomBy(2)} />
              </span>
            }
          />

        {scene && (
          <SidebarSection className={styles.frame}>
            <Button variant="light-accent" stretch disabled={!!busy} onClick={() => file.current?.click()}>{t.uploadImage}</Button>
            <input
              ref={file}
              type="file"
              accept={MAP_IMAGE_ACCEPT}
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0]
                e.target.value = ''
                if (f) void upload(f)
              }}
            />
            {busy && <p className={styles.note}>{busy}</p>}
            {error && <p className={styles.error}>{error}</p>}
          </SidebarSection>
        )}

        {scene && image && (
          <>
            <SidebarSection className={styles.frame}>
              <RowSwitch label={t.grid} checked={scene.grid.enabled} onChange={(v) => dispatch({ type: 'grid', patch: { enabled: v } })} />
              <NumberField label={t.gridSize} value={scene.grid.size} min={1} max={10} step={0.01} onChange={(v) => dispatch({ type: 'grid', patch: { size: v } })} />
              <div className={styles.pair}>
                <NumberField label={t.gridX} value={scene.grid.offsetX} onChange={(v) => dispatch({ type: 'grid', patch: { offsetX: v } })} />
                <NumberField label={t.gridY} scrub="y" value={scene.grid.offsetY} onChange={(v) => dispatch({ type: 'grid', patch: { offsetY: v } })} />
              </div>
            </SidebarSection>

            <SidebarSection className={styles.frame}>
              <RowSubtitle>{t.objects}</RowSubtitle>
              <div className={styles.tools}>
                <IconButton variant="chat" stretch pressed={tool === 'spawn'} label={t.spawn} icon={<Icon name="home" />} onClick={() => pick('spawn')} />
                <IconButton variant="chat" stretch pressed={tool === 'wall'} label={t.wall} icon={<Icon name="wall.bricks" />} onClick={() => pick('wall')} />
                <IconButton variant="chat" stretch pressed={tool === 'barrier'} label={t.barrier} icon={<Icon name="wall.barrier" />} onClick={() => pick('barrier')} />
                <IconButton variant="chat" stretch pressed={tool === 'door'} label={t.door} icon={<Icon name="door" />} onClick={() => pick('door')} />
                <IconButton variant="chat" stretch pressed={tool === 'build-erase'} label={t.objectsEraser} icon={<Icon name="eraser" />} onClick={() => pick('build-erase')} />
              </div>
            </SidebarSection>

            <SidebarSection className={styles.frame}>
              <RowSubtitle>{t.fog}</RowSubtitle>
              <div className={styles.brush}>
                <IconButton variant="chat" pressed={tool === 'fog-paint'} label={t.fogBrush} icon={<Icon name="fog.of.war" />} onClick={() => pick('fog-paint')} />
                <Slider value={brush} min={1} max={20} onChange={onBrush} aria-label={t.brushSize} />
                <IconButton variant="chat" pressed={tool === 'fog-erase'} label={t.fogEraser} icon={<Icon name="eraser" />} onClick={() => pick('fog-erase')} />
              </div>
              <div className={styles.pair}>
                <Button variant="secondary" stretch onClick={() => dispatch({ type: 'fog.add', stroke: { id: newId(), mode: 'cover' } })}>{t.fogCover}</Button>
                <Button variant="secondary" stretch disabled={!scene.fog.length} onClick={() => dispatch({ type: 'fog.clear' })}>{t.fogClear}</Button>
              </div>
            </SidebarSection>

            <SidebarSection className={styles.frame}>
              <RowSubtitle>{t.conditions}</RowSubtitle>
              <RuleRow label={t.freeMovement} rule="freeMove" scene={scene} campaign={settings} onPatch={(patch) => dispatch({ type: 'rules', patch })} />
              {rulesOf(scene, settings).freeMove && (
                <RuleRow label={t.freeDoors} rule="freeDoors" scene={scene} campaign={settings} onPatch={(patch) => dispatch({ type: 'rules', patch })} />
              )}
              <RowSwitch label={t.darkness} checked={!!scene.rules.darkness} onChange={(v) => dispatch({ type: 'rules', patch: { darkness: v || null } })} />
              <RuleRow label={t.dynamicFog} rule="dynamicFog" scene={scene} campaign={settings} onPatch={(patch) => dispatch({ type: 'rules', patch })} />
            </SidebarSection>

            <SidebarSection fill className={cx(styles.frame, styles.npcSection)}>
              <RowSubtitle>{t.npc}</RowSubtitle>
              <RowSwitch label={t.showCatalog} checked={catalog} onChange={setCatalog} />
              <SearchInput value={query} placeholder={s.common.search} onChange={(e) => setQuery(e.target.value)} />
              <div className={styles.npcList}>
                {npcs.map((n) => (
                  <NpcCard key={n.key} layout="list" image={n.image} name={n.name} note={n.note} className={styles.dragCard} onPointerDown={dragIn(n.token)} />
                ))}
                {!npcs.length && <p className={styles.note}>{!catalog && !query && !session.campaign.npcs.length ? t.noNpc : s.common.nothingFound}</p>}
              </div>
            </SidebarSection>
          </>
        )}
      </div>

      <SidebarSection className={styles.save}>
        <Button stretch disabled={session.saved} onClick={() => void session.save()}>{s.common.save}</Button>
      </SidebarSection>
    </aside>
  )
}
