import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react'
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
