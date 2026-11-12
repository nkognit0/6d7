import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
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

export interface MenuPoint {
  x: number
  y: number
}

/** State of a context menu: `open` goes to onContextMenu of the element. */
export function useContextMenu() {
  const [at, setAt] = useState<MenuPoint | null>(null)
  const open = useCallback((e: { preventDefault(): void; clientX: number; clientY: number }) => {
    e.preventDefault()
    setAt({ x: e.clientX, y: e.clientY })
  }, [])
  const close = useCallback(() => setAt(null), [])
  return { at, open, close }
}

// the gap between the menu and the edge of the window (spacer-m)
const EDGE = 8

/**
 * A context menu at the pointer (right click), Figma: Menu items (24:1913). Stays inside the
 * window; closes on a click outside, Escape, scrolling or a click on an item.
 */
export function ContextMenu({ at, onClose, children, className }: {
  at: MenuPoint | null
  onClose: () => void
  /** MenuItem, MenuDivider */
  children: ReactNode
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<MenuPoint | null>(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!at || !el) return setPos(null)
    const r = el.getBoundingClientRect()
    setPos({
      x: Math.max(EDGE, Math.min(at.x, innerWidth - r.width - EDGE)),
      y: Math.max(EDGE, Math.min(at.y, innerHeight - r.height - EDGE))
    })
  }, [at])

  useEffect(() => {
    if (!at) return
    const outside = (e: Event) => {
      if (!ref.current?.contains(e.target as Node)) onClose()
    }
    const key = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('pointerdown', outside, true)
    document.addEventListener('contextmenu', outside, true)
    document.addEventListener('scroll', onClose, true)
    document.addEventListener('keydown', key)
    addEventListener('resize', onClose)
    addEventListener('blur', onClose)
    return () => {
      document.removeEventListener('pointerdown', outside, true)
      document.removeEventListener('contextmenu', outside, true)
      document.removeEventListener('scroll', onClose, true)
      document.removeEventListener('keydown', key)
      removeEventListener('resize', onClose)
      removeEventListener('blur', onClose)
    }
  }, [at, onClose])

  if (!at) return null
  const p = pos ?? at
  return createPortal(
    <div ref={ref} className={cx(styles.context, className)} style={{ left: p.x, top: p.y }} onContextMenu={(e) => e.preventDefault()}>
      <Menu>
        <div className={styles.items} onClick={onClose}>{children}</div>
      </Menu>
    </div>,
    document.body
  )
}
