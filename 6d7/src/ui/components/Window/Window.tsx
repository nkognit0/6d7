import type { ReactNode } from 'react'
import { cx } from '../../lib'
import styles from './Window.module.css'

/**
 * D&D VTT / game / inventory windows (33:6729, 34:6975): a large window split into panes —
 * the main pane and side panes (description, spell slots) on the secondary background.
 */
export function GameWindow({ children, className }: { children: ReactNode; className?: string }) {
  return <div role="dialog" className={cx(styles.window, className)}>{children}</div>
}

/** One column of a GameWindow: header section, scrolling body, footer section. */
export function WindowPane({ header, footer, children, side, width, className }: {
  header?: ReactNode
  footer?: ReactNode
  children?: ReactNode
  /** side panes have the secondary background and a line on the left */
  side?: boolean
  width?: number
  className?: string
}) {
  return (
    <section className={cx(styles.pane, side && styles.side, className)} style={width ? { flex: `0 0 ${width}px` } : undefined}>
      {header && <div className={styles.header}>{header}</div>}
      <div className={styles.body}>{children}</div>
      {footer && <div className={styles.footer}>{footer}</div>}
    </section>
  )
}
