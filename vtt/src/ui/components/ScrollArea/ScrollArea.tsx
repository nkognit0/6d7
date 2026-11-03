import { forwardRef, type HTMLAttributes } from 'react'
import { cx } from '../../lib'
import styles from './ScrollArea.module.css'

/**
 * Figma: Bars / scroll-bar (1:1382): a scrolling box with the library's scroll bar — 12 px
 * gutter, 6 px round thumb (bg/scroll), blue while dragged.
 */
export const ScrollArea = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement> & { horizontal?: boolean }>(function ScrollArea(
  { horizontal, className, ...rest }, ref
) {
  return <div ref={ref} className={cx(styles.scroll, horizontal && styles.horizontal, className)} {...rest} />
})
