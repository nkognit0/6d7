import type { ReactNode } from 'react'
import { cx } from '../../lib'
import styles from './Sidebar.module.css'

/**
 * Figma: Sidebar sections / section-general (887:4304): a block of a side panel — 12 px side
 * padding, 8 px between rows, a line under it. `fill` lets it take the free height (lists).
 */
export function SidebarSection({ children, fill, className }: { children: ReactNode; fill?: boolean; className?: string }) {
  return <section className={cx(styles.section, fill && styles.fill, className)}>{children}</section>
}

/** Figma: Sidebar sections / section-title (887:4452): the panel title, an action and an optional search. */
export function SidebarTitle({ title, action, children, className }: { title: ReactNode; action?: ReactNode; children?: ReactNode; className?: string }) {
  return (
    <SidebarSection className={className}>
      <RowTitle title={title} action={action} />
      {children}
    </SidebarSection>
  )
}

/** Figma: Sidebar rows / row-title (32:2409): semibold title with optional buttons on the right. */
export function RowTitle({ title, action, inactive, className }: { title: ReactNode; action?: ReactNode; inactive?: boolean; className?: string }) {
  return (
    <div className={cx(styles.rowTitle, inactive && styles.inactive, className)}>
      <span className={styles.titleText}>{title}</span>
      {action}
    </div>
  )
}
