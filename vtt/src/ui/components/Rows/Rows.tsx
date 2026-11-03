import type { HTMLAttributes, ReactNode } from 'react'
import { cx, stateAttr, type PreviewState } from '../../lib'
import { Switch } from '../Switch/Switch'
import styles from './Rows.module.css'

/** Figma: Sidebar rows / row-subtitle (32:2770): a subsection name with optional icon buttons. */
export function RowSubtitle({ children, tone = 'primary', actions, inactive, className }: {
  children: ReactNode
  tone?: 'primary' | 'secondary'
  actions?: ReactNode
  inactive?: boolean
  className?: string
}) {
  return (
    <div className={cx(styles.subtitle, styles[tone], inactive && styles.inactive, className)}>
      <span className={styles.text}>{children}</span>
      {actions}
    </div>
  )
}

/**
 * Figma: Sidebar rows / row-input-line (32:3139), row-input-dropdown (32:3950),
 * row-input-multiline (32:3870): a label with a control. Inline: label in 2 of 5 columns,
 * control in 3; stacked: label above the control.
 */
export function RowField({ label, layout = 'inline', inactive, htmlFor, children, className }: {
  label: ReactNode
  layout?: 'inline' | 'stacked'
  inactive?: boolean
  htmlFor?: string
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cx(styles.field, styles[layout], inactive && styles.inactive, className)}>
      <label className={styles.label} htmlFor={htmlFor}>{label}</label>
      <div className={styles.control}>{children}</div>
    </div>
  )
}

/**
 * Figma: Sidebar rows / row-card (89:1647): a selectable list row (maps of the campaign) with
 * icon buttons on the right.
 */
export function RowCard({ children, selected, status, inactive, actions, previewState, className, ...rest }: HTMLAttributes<HTMLDivElement> & {
  selected?: boolean
  status?: 'alert' | 'error'
  inactive?: boolean
  actions?: ReactNode
  previewState?: Extract<PreviewState, 'hover' | 'focus'>
}) {
  return (
    <div
      role="option"
      aria-selected={!!selected}
      aria-disabled={inactive || undefined}
      tabIndex={inactive ? -1 : 0}
      className={cx(styles.card, status && styles[status], inactive && styles.cardInactive, className)}
      {...stateAttr(previewState)}
      {...rest}
    >
      <span className={styles.text}>{children}</span>
      {actions && <span className={styles.cardActions} onClick={(e) => e.stopPropagation()}>{actions}</span>}
    </div>
  )
}

/** Figma: Sidebar rows / row-nav-assets (329:879): a row of tabs (Карты / NPC) with an optional button. */
export function RowTabs({ children, action, stretch, className }: { children: ReactNode; action?: ReactNode; stretch?: boolean; className?: string }) {
  return (
    <div className={cx(styles.tabs, stretch && styles.tabsStretch, className)} role="tablist">
      {children}
      {action && <span className={styles.tabsAction}>{action}</span>}
    </div>
  )
}

/** Figma: Sidebar rows / row-input-switch (38:247): a label with a switch on the right. */
export function RowSwitch({ label, checked, onChange, disabled, className }: {
  label: ReactNode
  checked: boolean
  onChange?: (checked: boolean) => void
  disabled?: boolean
  className?: string
}) {
  return (
    <label className={cx(styles.switchRow, disabled && styles.inactive, className)}>
      <span className={styles.text}>{label}</span>
      <Switch checked={checked} onChange={onChange} disabled={disabled} aria-label={typeof label === 'string' ? label : undefined} />
    </label>
  )
}
