import type { ReactNode } from 'react'
import { cx } from '../../lib'
import styles from './Bars.module.css'

/** Figma: Top panel / top-panel (100:3404): 44 px bar with left, center and right groups. */
export function TopPanel({ left, center, right, className }: { left?: ReactNode; center?: ReactNode; right?: ReactNode; className?: string }) {
  return (
    <header className={cx(styles.top, className)}>
      <div className={styles.group}>{left}</div>
      <div className={cx(styles.group, styles.center)}>{center}</div>
      <div className={cx(styles.group, styles.end)}>{right}</div>
    </header>
  )
}

/** Figma: Bottom navigation / bottom-navigation (100:3004): page buttons in the middle, extra on the right. */
export function BottomNavigation({ children, right, className }: { children: ReactNode; right?: ReactNode; className?: string }) {
  return (
    <nav className={cx(styles.bottom, className)}>
      <div className={styles.group}>{children}</div>
      {right && <div className={cx(styles.group, styles.bottomRight)}>{right}</div>}
    </nav>
  )
}
