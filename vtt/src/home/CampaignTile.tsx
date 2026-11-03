import type { CampaignMeta } from '../campaign'
import { useMediaUrl } from '../game/media/media'
import { useStrings } from '../i18n'
import { Button, CampaignCard, ContextMenu, InlineEdit, MenuItem, useContextMenu } from '../ui'

/**
 * A campaign on the home screen: its first map, name, players, «Играть» and «Редактировать».
 * The right button opens «Переименовать» and «Удалить»; renaming turns the name into a field.
 */
export function CampaignTile({ meta, renaming, onPlay, onEdit, onRenameStart, onRename, onDelete }: {
  meta: CampaignMeta
  renaming: boolean
  onPlay: () => void
  onEdit: () => void
  onRenameStart: () => void
  /** null — the name stays */
  onRename: (name: string | null) => void
  onDelete: () => void
}) {
  const s = useStrings()
  const menu = useContextMenu()
  const preview = useMediaUrl(meta.preview as `media:${string}` | null)
  return (
    <>
      <CampaignCard
        name={renaming ? <InlineEdit value={meta.name} aria-label={s.campaign.nameField} onDone={onRename} /> : meta.name}
        preview={preview ?? undefined}
        players={meta.players.map((p) => ({ name: p.name || '?', color: p.color }))}
        onContextMenu={menu.open}
        actions={
          <>
            <Button onClick={onPlay}>{s.home.play}</Button>
            <Button variant="primary" onClick={onEdit}>{s.home.edit}</Button>
          </>
        }
      />
      <ContextMenu at={menu.at} onClose={menu.close}>
        <MenuItem onClick={onRenameStart}>{s.common.rename}</MenuItem>
        <MenuItem onClick={onDelete}>{s.common.delete}</MenuItem>
      </ContextMenu>
    </>
  )
}
