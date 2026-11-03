import type { ButtonHTMLAttributes } from 'react'
import { cx, stateAttr, type PreviewState } from '../../lib'
import styles from './Switch.module.css'

/** Figma: Switches / switch (1:1261). */
export type SwitchProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onChange'> & {
  checked: boolean
  onChange?: (checked: boolean) => void
  /** visible text on the right; without it pass aria-label */
  label?: string
  previewState?: Extract<PreviewState, 'focus'>
}

export function Switch({ checked, onChange, label, previewState, className, disabled, ...rest }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      className={cx(styles.switch, className)}
      onClick={() => onChange?.(!checked)}
      {...stateAttr(previewState)}
      {...rest}
    >
      <span className={styles.track}>
        <span className={styles.knob} />
      </span>
      {label && <span className={styles.label}>{label}</span>}
    </button>
  )
}
