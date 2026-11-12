import { forwardRef, type TextareaHTMLAttributes } from 'react'
import { cx, stateAttr, type PreviewState } from '../../lib'
import type { FieldStatus } from '../TextInput/TextInput'
import styles from './Textarea.module.css'

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  status?: FieldStatus
  previewState?: PreviewState
}

/** Figma: Input fields / text-input-multiline (7:1113): text with 18 px lines, frame like text-input-line. */
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea({ status, previewState, className, ...rest }, ref) {
  return <textarea ref={ref} className={cx(styles.textarea, status && styles[status], className)} {...stateAttr(previewState)} {...rest} />
})
