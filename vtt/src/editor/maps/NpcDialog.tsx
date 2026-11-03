import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { mapKey, type CampaignSession } from '../../campaign'
import { useStrings } from '../../i18n'
import { newId, type Token } from '../../map'
import { Button, Modal, RowField, Textarea, TextInput } from '../../ui'
import { rarityText } from './MapPanel'
import styles from './Maps.module.css'

// the gap between the window and what it stands next to (spacer-xl)
const GAP = 16

/**
 * D&D VTT / editor / maps (40:2994): the window of an NPC on the map, next to it — its name and
 * description. «Сохранить» makes it a unique NPC of the campaign («Сохранённые» of the NPC
 * catalog). «Убрать с карты» is not in the mockup: the NPC leaves the map (Delete does the same).
 */
export function NpcDialog({ session, mapId, token, at, onClose }: {
  session: CampaignSession
  mapId: string
  token: Token
  /** the point of the click on the screen */
  at: { x: number; y: number }
  onClose: () => void
}) {
  const s = useStrings()
  const t = s.editor.maps
  const saved = token.saved ? session.campaign.npcs.find((n) => n.id === token.saved) : undefined
  const [name, setName] = useState(saved?.name ?? token.name)
  const [description, setDescription] = useState(saved?.description ?? (token.token ? rarityText(token.token) : ''))
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)

  // to the right of the click, inside the window
  useLayoutEffect(() => {
    const r = ref.current?.getBoundingClientRect()
    if (!r) return
    setPos({
      x: Math.max(GAP, Math.min(at.x + GAP, innerWidth - r.width - GAP)),
      y: Math.max(GAP, Math.min(at.y - GAP, innerHeight - r.height - GAP))
    })
  }, [at])

  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', key)
    return () => document.removeEventListener('keydown', key)
  }, [onClose])

  const save = () => {
    const id = token.saved ?? newId()
    const clean = name.trim() || token.name
    session.apply([
      { doc: 'campaign', op: { type: 'npc.put', npc: { id, token: token.token ?? '', name: clean, description } } },
      { doc: mapKey(mapId), op: { type: 'token.update', id: token.id, patch: { name: clean, saved: id } } }
    ])
    onClose()
  }

  const remove = () => {
    session.apply([{ doc: mapKey(mapId), op: { type: 'token.remove', id: token.id } }])
    onClose()
  }

  return (
    <div ref={ref} className={styles.npcDialog} style={{ left: (pos ?? at).x, top: (pos ?? at).y, visibility: pos ? undefined : 'hidden' }}>
      <Modal title={name.trim() || token.name} onClose={onClose}>
        <form
          className={styles.npcForm}
          onSubmit={(e) => {
            e.preventDefault()
            save()
          }}
        >
          <RowField label={t.npcName}>
            <TextInput autoFocus value={name} onChange={(e) => setName(e.target.value)} />
          </RowField>
          <RowField label={t.npcDescription} layout="stacked">
            <Textarea value={description} rows={5} onChange={(e) => setDescription(e.target.value)} />
          </RowField>
          <Button type="submit" stretch>{s.common.save}</Button>
          <Button variant="primary" stretch onClick={remove}>{t.removeFromMap}</Button>
        </form>
      </Modal>
    </div>
  )
}
