import { useState } from 'react'
import { Icon } from '../../icons/Icon'
import { cx, stateAttr, type PreviewState } from '../../lib'
import { Menu, MenuItem, Popover } from '../Menu/Menu'
import type { FieldStatus } from '../TextInput/TextInput'
import styles from './Select.module.css'

export type SelectOption<V extends string> = { value: V; label: string; disabled?: boolean }

export type SelectProps<V extends string> = {
  value: V | null
  options: SelectOption<V>[]
  onChange: (value: V) => void
  placeholder?: string
  status?: FieldStatus
  disabled?: boolean
  className?: string
  'aria-label'?: string
  previewState?: PreviewState
}

/** Figma: Dropdowns / dropdown-text (20:925) with a Menu list. */
export function Select<V extends string>({ value, options, onChange, placeholder = 'Выбрать', status, disabled, className, previewState, ...aria }: SelectProps<V>) {
  const [open, setOpen] = useState(false)
  const current = options.find((o) => o.value === value)
  const shown = open ? 'active' : previewState
  return (
    <div className={cx(styles.select, className)}>
      <button
        type="button"
        className={cx(styles.field, status && styles[status])}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={aria['aria-label']}
        onClick={() => setOpen((o) => !o)}
        {...stateAttr(shown)}
      >
        <span className={cx(styles.value, !current && styles.placeholder)}>{current ? current.label : placeholder}</span>
        <span className={cx(styles.chevron, open && styles.up)}>
          <Icon name="chevron.down" />
        </span>
      </button>
      <Popover open={open} onClose={() => setOpen(false)}>
        <Menu role="listbox" className={styles.menu}>
          {options.map((o) => (
            <MenuItem
              key={o.value}
              role="option"
              selected={o.value === value}
              disabled={o.disabled}
              onClick={() => {
                onChange(o.value)
                setOpen(false)
              }}
            >
              {o.label}
            </MenuItem>
          ))}
        </Menu>
      </Popover>
    </div>
  )
}
