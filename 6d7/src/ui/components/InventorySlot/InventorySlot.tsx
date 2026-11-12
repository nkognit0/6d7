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
 * D&D VTT / game / inventory-slot (33:6735): a square cell of the item and spell inventories.
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
 * 100 px; the cells stretch to fill the width and never go past it. A container too narrow for
 * cells of 80 px takes fewer, larger ones rather than overflowing.
 */
export function slotColumns(width: number, gap: number): number {
  let n = Math.max(1, Math.ceil((width + gap) / (MAX + gap)))
  while (n > 1 && (width - gap * (n - 1)) / n < MIN) n--
  return n
}

/** The grid of slots: square cells of 80–100 px, 8 px apart, left to right and top to bottom across the whole width. */
export function SlotGrid({ children, className }: { children: ReactNode; className?: string }) {
  const grid = useRef<HTMLDivElement>(null)
  const [columns, setColumns] = useState<number | null>(null)
  useLayoutEffect(() => {
    const el = grid.current
    if (!el) return
    const fit = () => setColumns(slotColumns(el.clientWidth, parseFloat(getComputedStyle(el).columnGap) || 0))
    fit()
    const watch = new ResizeObserver(fit)
    watch.observe(el)
    return () => watch.disconnect()
  }, [])
  return (
    <div ref={grid} className={cx(styles.grid, className)} style={columns ? { gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` } : undefined}>
      {children}
    </div>
  )
}
