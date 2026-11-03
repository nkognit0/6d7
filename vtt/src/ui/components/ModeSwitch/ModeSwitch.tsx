import type { ReactNode } from 'react'
import { cx, stateAttr, type PreviewState } from '../../lib'
import styles from './ModeSwitch.module.css'

export interface ModeOption<T extends string> {
  value: T
  label: string
  /** a 16 px icon */
  icon: ReactNode
}

/**
 * Figma: top-panel / mode-switch (D&D VTT 6:422 → 100:3310): icon buttons on one plate, the
 * chosen one on a dark tile. The editor switches «Редактирование» and «Глазами игрока» with it.
 */
export function ModeSwitch<T extends string>({ options, value, onChange, previewState, className }: {
  options: ModeOption<T>[]
  value: T
  onChange: (value: T) => void
  /** fixes the hover look of the first not chosen button on the preview page */
  previewState?: Extract<PreviewState, 'hover' | 'focus'>
  className?: string
}) {
  const firstOther = options.find((o) => o.value !== value)?.value
  return (
    <div role="radiogroup" className={cx(styles.switch, className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          aria-label={o.label}
          title={o.label}
          className={styles.option}
          onClick={() => onChange(o.value)}
          {...stateAttr(o.value === firstOther ? previewState : undefined)}
        >
          {o.icon}
        </button>
      ))}
    </div>
  )
}
