import type { CSSProperties } from 'react'
import type { PlayerColor } from '../../icons/Icon'
import { cx } from '../../lib'
import styles from './Avatar.module.css'

/**
 * Figma: Avatars / avatar (26:711): a 28 px circle with a picture, or the first letter of the
 * name on a player color (flow/*).
 */
export type AvatarProps = {
  name: string
  color?: Exclude<PlayerColor, 'grey'>
  src?: string
  /** outline that separates overlapping avatars (campaign cards) */
  ring?: boolean
  className?: string
  style?: CSSProperties
}

export function Avatar({ name, color = 'orange', src, ring, className, style }: AvatarProps) {
  const letter = name.trim().charAt(0).toUpperCase() || '?'
  return (
    <span
      className={cx(styles.avatar, ring && styles.ring, className)}
      style={{ background: src ? undefined : `var(--flow-${color})`, ...style }}
      role="img"
      aria-label={name}
      title={name}
    >
      {src ? <img className={styles.image} src={src} alt="" /> : <span className={styles.letter}>{letter}</span>}
    </span>
  )
}
