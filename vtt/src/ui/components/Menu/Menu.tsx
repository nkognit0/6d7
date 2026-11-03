import { useEffect, useRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { cx, stateAttr, type PreviewState } from '../../lib'
import styles from './Menu.module.css'

/** Figma: Menu items — the context menu panel (24:1913). */
export function Menu({ children, className, role = 'menu' }: { children: ReactNode; className?: string; role?: 'menu' | 'listbox' }) {
  return (
    <div className={cx(styles.menu, className)} role={role}>
      {children}
    </div>
  )
}

export type MenuItemProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  /** 16 px icon on the left (Figma icon-item) */
  icon?: ReactNode
  /** right-aligned hint, e.g. a shortcut */
  hint?: string
  /** the current option of a select */
  selected?: boolean
  previewState?: Extract<PreviewState, 'hover' | 'active'>
}

/** Figma: Menu items / item (24:1292) and icon-item (24:1973). */
export function MenuItem({ icon, hint, selected, previewState, className, children, type = 'button', ...rest }: MenuItemProps) {
  return (
    <button
      type={type}
      role="menuitem"
      aria-current={selected || undefined}
      className={cx(styles.item, icon ? styles.withIcon : undefined, className)}
      {...stateAttr(previewState)}
      {...rest}
    >
      {icon && <span className={styles.icon}>{icon}</span>}
      <span className={styles.text}>{children}</span>
      {hint && <span className={styles.hint}>{hint}</span>}
    </button>
  )
}

/** Figma: Menu items / divider (24:1305). */
export function MenuDivider() {
  return <div className={styles.divider} role="separator" />
}

/**
 * A menu that opens under its trigger and closes on a click outside or Escape. The caller keeps
 * `open` and renders the trigger itself.
 */
export function Popover({ open, onClose, children, align = 'start', className }: {
  open: boolean
  onClose: () => void
  children: ReactNode
  align?: 'start' | 'end'
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      const anchor = ref.current?.parentElement
      if (anchor && !anchor.contains(e.target as Node)) onClose()
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])
  if (!open) return null
  return (
    <div ref={ref} className={cx(styles.popover, align === 'end' && styles.alignEnd, className)}>
      {children}
    </div>
  )
}
