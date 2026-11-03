import type { ButtonHTMLAttributes } from 'react'
import { Icon } from '../../icons/Icon'
import { cx, stateAttr, type PreviewState } from '../../lib'
import styles from './Checkbox.module.css'

/** Figma: Checkboxes / checkbox (5:286), statuses off and on. */
export type CheckboxProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onChange'> & {
  checked: boolean
  onChange?: (checked: boolean) => void
  /** visible text on the right; without it pass aria-label */
  label?: string
  previewState?: Extract<PreviewState, 'hover' | 'focus'>
}

export function Checkbox({ checked, onChange, label, previewState, className, ...rest }: CheckboxProps) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      className={cx(styles.checkbox, className)}
      onClick={() => onChange?.(!checked)}
      {...stateAttr(previewState)}
      {...rest}
    >
      <span className={styles.box}>{checked && <Icon name="checkbox.checked" />}</span>
      {label && <span className={styles.label}>{label}</span>}
    </button>
  )
}
