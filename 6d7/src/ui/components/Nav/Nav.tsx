import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cx, stateAttr, type PreviewState } from '../../lib'
import styles from './Nav.module.css'

type NavBase = ButtonHTMLAttributes<HTMLButtonElement> & {
  /** this tab or page is open */
  selected?: boolean
  /** blue dot: something new inside */
  indicator?: boolean
  previewState?: Exclude<PreviewState, 'active'>
}

/** Figma: Navigation / nav-tab (27:1960): text tabs (Каталог / Сохраненные, Все / Заговоры / 1–9). */
export function NavTab({ selected, indicator, previewState, className, children, type = 'button', ...rest }: NavBase) {
  return (
    <button
      type={type}
      role="tab"
      aria-selected={!!selected}
      className={cx(styles.tab, className)}
      {...stateAttr(previewState)}
      {...rest}
    >
      {indicator && !selected && <span className={styles.dot} />}
      {children}
    </button>
  )
}

/** Figma: Navigation / nav-page (27:1948): icon and page name of the bottom navigation. */
export function NavPage({ icon, selected, indicator, previewState, className, children, type = 'button', ...rest }: NavBase & { icon: ReactNode }) {
  return (
    <button
      type={type}
      aria-current={selected ? 'page' : undefined}
      aria-label={children ? undefined : rest.title}
      className={cx(styles.page, children ? styles.named : undefined, className)}
      {...stateAttr(previewState)}
      {...rest}
    >
      <span className={styles.pageIcon}>{icon}</span>
      {children && <span className={styles.pageName}>{children}</span>}
      {indicator && <span className={cx(styles.dot, styles.corner)} />}
    </button>
  )
}
