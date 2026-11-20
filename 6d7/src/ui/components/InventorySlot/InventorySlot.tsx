import { useLayoutEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { cx } from '../../lib'
import styles from './InventorySlot.module.css'

/** Рамка ячейки: ярко-синяя — экипирована (у заклинаний — подготовлено), жёлтая — настройка. */
export type SlotMark = 'equipped' | 'attuned'

/** The frame of a slot from the item's state: attunement implies the item is equipped (an app convention), so it wins. */
export function slotMark({ equipped, attuned }: { equipped?: boolean; attuned?: boolean }): SlotMark | undefined {
  if (attuned) return 'attuned'
  return equipped ? 'equipped' : undefined
}

/**
 * 6d7 / game / inventory-slot (33:6735): a square cell of the item and spell inventories.
 * `mark` sets the frame; `selected` (the thing shown in the description) fills the cell like the
 * hover of the player's menu buttons, so it never hides the frame. An empty cell is not clickable.
 */
export function InventorySlot({ children, mark, selected, label, className, type = 'button', ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & {
  children?: ReactNode
  mark?: SlotMark
  selected?: boolean
  /** accessible name of the item */
  label?: string
}) {
  const empty = !children
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      aria-pressed={empty ? undefined : !!selected}
      disabled={empty}
      className={cx(styles.slot, mark && styles[mark], selected && styles.selected, className)}
      {...rest}
    >
      {children}
    </button>
  )
}

const MIN = 80
const MAX = 100

/**
 * Columns for a width, like file cards in Figma: the fewest columns that keep a cell within
 * `max` px; the cells stretch to fill the width and never go past it. A container too narrow for
 * cells of `min` px takes fewer, larger ones rather than overflowing.
 */
export function slotColumns(width: number, gap: number, min = MIN, max = MAX): number {
  let n = Math.max(1, Math.ceil((width + gap) / (max + gap)))
  while (n > 1 && (width - gap * (n - 1)) / n < min) n--
  return n
}

/**
 * The grid of slots: cells of `min`–`max` px (80–100 by default), 8 px apart, left to right and
 * top to bottom across the whole width — no empty strip on the right. Also the cards of the NPC
 * catalog (130–150 px).
 */
export function SlotGrid({ children, className, min = MIN, max = MAX }: { children: ReactNode; className?: string; min?: number; max?: number }) {
  const grid = useRef<HTMLDivElement>(null)
  const [columns, setColumns] = useState<number | null>(null)
  useLayoutEffect(() => {
    const el = grid.current
    if (!el) return
    const fit = () => {
      const css = getComputedStyle(el)
      const width = el.clientWidth - (parseFloat(css.paddingLeft) || 0) - (parseFloat(css.paddingRight) || 0)
      setColumns(slotColumns(width, parseFloat(css.columnGap) || 0, min, max))
    }
    fit()
    const watch = new ResizeObserver(fit)
    watch.observe(el)
    return () => watch.disconnect()
  }, [min, max])
  return (
    <div ref={grid} className={cx(styles.grid, className)} style={columns ? { gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` } : undefined}>
      {children}
    </div>
  )
}
