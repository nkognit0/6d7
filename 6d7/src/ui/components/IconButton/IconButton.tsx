import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cx, stateAttr, type PreviewState } from '../../lib'
import styles from './IconButton.module.css'

/**
 * Figma: button-icon-primary (plain), button-icon-switch (toggle: `pressed` keeps the background),
 * button-chat (filled with the info background).
 */
export type IconButtonVariant = 'primary' | 'switch' | 'chat'

export type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  icon: ReactNode
  /** accessible name: the buttons have no visible text */
  label: string
  variant?: IconButtonVariant
  /** switch variant: the toggle is on */
  pressed?: boolean
  /** take the free width of the parent (rows of tool buttons) */
  stretch?: boolean
  previewState?: PreviewState
}

export function IconButton({ icon, label, variant = 'primary', pressed, stretch, previewState, className, type = 'button', ...rest }: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      aria-pressed={variant === 'switch' || (variant === 'chat' && pressed !== undefined) ? !!pressed : undefined}
      className={cx(styles.button, styles[variant], stretch && styles.stretch, className)}
      {...stateAttr(previewState)}
      {...rest}
    >
      {icon}
    </button>
  )
}
