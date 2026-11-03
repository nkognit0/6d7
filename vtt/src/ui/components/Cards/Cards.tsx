import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react'
import { cx } from '../../lib'
import { Avatar, type AvatarProps } from '../Avatar/Avatar'
import styles from './Cards.module.css'

/**
 * D&D VTT: NPC card with the token picture, name and rarity.
 * grid — catalog tile (14:1451, 116 px); list — side panel row (13:1179, 56 px picture);
 * preview — big picture in the NPC panel (40:3918).
 */
export function NpcCard({ image, name, note, layout = 'grid', selected, className, type = 'button', ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & {
  image: string
  name: string
  /** second line: rarity or description */
  note?: string
  layout?: 'grid' | 'list' | 'preview'
  selected?: boolean
}) {
  const content = (
    <>
      <img className={styles.npcImage} src={image} alt="" draggable={false} />
      <span className={styles.npcText}>
        <span className={styles.npcName}>{name}</span>
        {note && <span className={styles.npcNote}>{note}</span>}
      </span>
    </>
  )
  const cls = cx(styles.npc, styles[layout], selected && styles.selected, className)
  if (layout === 'preview') return <div className={cls}>{content}</div>
  return (
    <button type={type} aria-pressed={!!selected} className={cls} {...rest}>
      {content}
    </button>
  )
}

/**
 * D&D VTT / home (17:1630): campaign tile — first map, name, players' avatars and the
 * Играть / Редактировать buttons.
 */
export function CampaignCard({ name, preview, players, actions, className, ...rest }: Omit<HTMLAttributes<HTMLElement>, 'children'> & {
  /** the name, or a field to rename it (InlineEdit) */
  name: ReactNode
  /** picture of the first map; without it a dark placeholder */
  preview?: string
  players: Pick<AvatarProps, 'name' | 'color'>[]
  /** buttons row */
  actions: ReactNode
}) {
  return (
    <article className={cx(styles.campaign, className)} {...rest}>
      <div className={styles.campaignPreview}>{preview && <img src={preview} alt="" />}</div>
      <div className={styles.campaignTitle}>
        <span className={styles.campaignName}>{name}</span>
        <span className={styles.players}>
          {players.map((p, i) => (
            <Avatar key={i} name={p.name} color={p.color} style={{ zIndex: players.length - i }} />
          ))}
        </span>
      </div>
      <div className={styles.campaignActions}>{actions}</div>
    </article>
  )
}
