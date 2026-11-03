import type { CSSProperties, ReactNode } from 'react'
import { Icon } from '../../icons/Icon'
import { cx } from '../../lib'
import { IconButton } from '../IconButton/IconButton'
import { RowTitle } from '../Sidebar/Sidebar'
import styles from './Modal.module.css'

/**
 * D&D VTT / game / modal/dice (34:7794): a small floating window — title with a close button,
 * rows under it. Opens next to its button, without an overlay.
 */
export function Modal({ title, onClose, children, className, style }: {
  title: ReactNode
  onClose?: () => void
  children: ReactNode
  className?: string
  style?: CSSProperties
}) {
  return (
    <div role="dialog" aria-label={typeof title === 'string' ? title : undefined} className={cx(styles.modal, className)} style={style}>
      <RowTitle title={title} action={onClose && <IconButton label="Закрыть" icon={<Icon name="close" />} onClick={onClose} />} />
      {children}
    </div>
  )
}

/** Figma: Menu items / divider (24:1305) used between blocks: a 1 px line with 4 px above and below. */
export function Divider({ className }: { className?: string }) {
  return <div className={cx(styles.divider, className)} role="separator" />
}

/**
 * D&D VTT / game (30:4208): black 40% overlay with an 8 px background blur under the sheet and
 * the inventories. A click on the overlay itself (outside the window) closes it.
 */
export function Overlay({ children, onClose, className }: { children: ReactNode; onClose?: () => void; className?: string }) {
  return (
    <div className={cx(styles.overlay, className)} onClick={(e) => e.target === e.currentTarget && onClose?.()}>
      {children}
    </div>
  )
}
