import { useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from 'react'
import { cx } from '../../lib'
import styles from './Slider.module.css'

/**
 * D&D VTT / editor (9:684): a slider with an optional label on the left and the value on the
 * right (grid size, fog brush). A native range input, so it works with touch and keyboard.
 */
export function Slider({ value, min, max, step = 1, onChange, label, valueText, disabled, className, 'aria-label': ariaLabel }: {
  value: number
  min: number
  max: number
  step?: number
  onChange: (value: number) => void
  label?: ReactNode
  /** text shown on the right; defaults to the value, null hides it */
  valueText?: ReactNode | null
  disabled?: boolean
  className?: string
  'aria-label'?: string
}) {
  const fill = ((value - min) / (max - min || 1)) * 100
  return (
    <label className={cx(styles.slider, disabled && styles.disabled, className)}>
      {label && <span className={styles.label}>{label}</span>}
      <input
        type="range"
        className={styles.range}
        style={{ '--fill': `${fill}%` } as CSSProperties}
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        aria-label={ariaLabel ?? (typeof label === 'string' ? label : undefined)}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      {valueText !== null && <span className={styles.value}>{valueText ?? value}</span>}
    </label>
  )
}

/**
 * D&D VTT / editor (9:749): a short number field with a bold label (grid offset X and Y, grid
 * size). As in Figma, dragging the label changes the value: `scrub` 'x' — right adds, left takes
 * away; 'y' — down adds, up takes away (the grid follows the pointer). One step per pixel, ten
 * with Shift. Values are kept in [min, max] and rounded to the step; the field shows as many
 * decimals as the step has.
 */
export function NumberField({ label, value, onChange, step = 1, min = -Infinity, max = Infinity, scrub = 'x', disabled, className }: {
  label: string
  value: number
  onChange: (value: number) => void
  step?: number
  min?: number
  max?: number
  scrub?: 'x' | 'y'
  disabled?: boolean
  className?: string
}) {
  const drag = useRef<{ from: number; value: number } | null>(null)
  // what is typed while the field has focus; a value out of range is not sent until it is fixed
  const [typed, setTyped] = useState<string | null>(null)
  const decimals = (String(step).split('.')[1] ?? '').length
  const fit = (v: number) => Number(Math.min(max, Math.max(min, v)).toFixed(decimals))
  const at = (e: PointerEvent<HTMLElement>) => (scrub === 'x' ? e.clientX : e.clientY)
  const scrubbing = {
    onPointerDown: (e: PointerEvent<HTMLSpanElement>) => {
      if (disabled || e.button !== 0) return
      // no focus or text selection: the letter is a handle
      e.preventDefault()
      try {
        e.currentTarget.setPointerCapture(e.pointerId)
      } catch {
        // the pointer is already gone: dragging still works over the letter
      }
      drag.current = { from: at(e), value }
      setTyped(null)
    },
    onPointerMove: (e: PointerEvent<HTMLSpanElement>) => {
      const d = drag.current
      if (!d) return
      const next = fit(d.value + Math.round(at(e) - d.from) * step * (e.shiftKey ? 10 : 1))
      if (next !== value) onChange(next)
    },
    onPointerUp: () => (drag.current = null),
    onPointerCancel: () => (drag.current = null)
  }
  return (
    <label className={cx(styles.number, disabled && styles.disabled, className)}>
      <span className={cx(styles.numberLabel, styles[scrub === 'x' ? 'scrubX' : 'scrubY'])} {...scrubbing}>{label}</span>
      <input
        type="number"
        className={styles.numberInput}
        value={typed ?? value.toFixed(decimals)}
        step={step}
        min={Number.isFinite(min) ? min : undefined}
        max={Number.isFinite(max) ? max : undefined}
        disabled={disabled}
        onChange={(e) => {
          const s = e.target.value
          setTyped(s)
          const n = Number(s)
          if (s.trim() !== '' && Number.isFinite(n) && n >= min && n <= max) onChange(fit(n))
        }}
        onBlur={() => setTyped(null)}
      />
    </label>
  )
}
