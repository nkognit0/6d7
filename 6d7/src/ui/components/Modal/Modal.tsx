import { useEffect, type CSSProperties, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from '../../icons/Icon'
import { cx } from '../../lib'
import { Button } from '../Button/Button'
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

/**
 * A question before what cannot be taken back («Вы уверены, что хотите удалить кампанию?»): the
 * text and two buttons in the window of modal/dice, over the overlay. Not in the mockups — built
 * from the library. «Отмена» has the focus; Escape and a click outside cancel too.
 */
export function ConfirmDialog({ text, confirm, cancel, onConfirm, onCancel }: {
  text: ReactNode
  confirm: string
  cancel: string
  onConfirm: () => void
  onCancel: () => void
}) {
  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === 'Escape' && onCancel()
    document.addEventListener('keydown', key)
    return () => document.removeEventListener('keydown', key)
  }, [onCancel])
  return createPortal(
    <Overlay onClose={onCancel} className={styles.center}>
      <div role="alertdialog" aria-modal="true" className={cx(styles.modal, styles.confirm)}>
        <p className={styles.confirmText}>{text}</p>
        <div className={styles.confirmActions}>
          <Button variant="primary" autoFocus onClick={onCancel}>{cancel}</Button>
          <Button onClick={onConfirm}>{confirm}</Button>
        </div>
      </div>
    </Overlay>,
    document.body
  )
}
