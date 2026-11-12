import { forwardRef, useRef, useState, type InputHTMLAttributes, type ReactNode } from 'react'
import { Icon } from '../../icons/Icon'
import { cx, stateAttr, type PreviewState } from '../../lib'
import styles from './TextInput.module.css'

/** Validation look of a field: Figma states alert and error. */
export type FieldStatus = 'alert' | 'error'

export type TextInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> & {
  status?: FieldStatus
  /** a 16 px icon on the left (the search field puts a magnifier here) */
  leading?: ReactNode
  /** icon buttons after the field, outside its frame */
  trailing?: ReactNode
  previewState?: PreviewState
  /** class of the outer wrapper (width, flex) */
  className?: string
}

/** Figma: Input fields / text-input-line (7:779). */
export const TextInput = forwardRef<HTMLInputElement, TextInputProps>(function TextInput(
  { status, leading, trailing, previewState, className, disabled, ...rest }, ref
) {
  return (
    <div className={cx(styles.wrapper, className)}>
      <label
        className={cx(styles.frame, leading ? styles.withLeading : undefined, status && styles[status], disabled && styles.disabled)}
        {...stateAttr(previewState)}
      >
        {leading && <span className={styles.leading}>{leading}</span>}
        <input ref={ref} className={styles.input} disabled={disabled} {...rest} />
      </label>
      {trailing}
    </div>
  )
})

/** Figma: Input fields / text-input-search (7:805): a field with a magnifier. */
export const SearchInput = forwardRef<HTMLInputElement, Omit<TextInputProps, 'leading'>>(function SearchInput(
  { placeholder = 'Поиск', type = 'search', ...rest }, ref
) {
  return <TextInput ref={ref} type={type} placeholder={placeholder} leading={<Icon name="search" />} {...rest} />
})

/**
 * A name that becomes a field to rename it (the campaign in the editor panel, on its tile): the
 * field in its focus look, with the font of the place. Enter or a click outside saves, Escape
 * cancels; `onDone(null)` — nothing to save (cancelled, empty or the same name).
 */
export function InlineEdit({ value, onDone, className, 'aria-label': label }: {
  value: string
  onDone: (value: string | null) => void
  className?: string
  'aria-label'?: string
}) {
  const [text, setText] = useState(value)
  const finished = useRef(false)
  const finish = (save: boolean) => {
    if (finished.current) return
    finished.current = true
    const name = text.trim()
    onDone(save && name && name !== value ? name : null)
  }
  return (
    <input
      autoFocus
      className={cx(styles.inline, className)}
      aria-label={label}
      value={text}
      onChange={(e) => setText(e.target.value)}
      onFocus={(e) => e.target.select()}
      onBlur={() => finish(true)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') finish(true)
        else if (e.key === 'Escape') finish(false)
      }}
    />
  )
}
