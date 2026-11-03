import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cx, stateAttr, type PreviewState } from '../../lib'
import styles from './Button.module.css'

/** Figma "button-large": role brand | primary | secondary | light-accent. */
export type ButtonVariant = 'brand' | 'primary' | 'secondary' | 'light-accent'

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  /** 16 px icon on the left edge */
  icon?: ReactNode
  /** take the whole width of the parent */
  stretch?: boolean
  previewState?: PreviewState
}

export function Button({ variant = 'brand', icon, stretch, previewState, className, children, type = 'button', ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      className={cx(styles.button, styles[variant === 'light-accent' ? 'lightAccent' : variant], stretch && styles.stretch, className)}
      {...stateAttr(previewState)}
      {...rest}
    >
      {icon && <span className={styles.icon}>{icon}</span>}
      <span className={styles.label}>{children}</span>
    </button>
  )
}
