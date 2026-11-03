import { Color } from 'pixi.js'
import type { FlowColor } from '../core/types'

/** A color of the design tokens split for Pixi: RGB number and alpha. */
export type Paint = { color: number; alpha: number }

/** Colors of the map, all taken from the design tokens (`--*` variables of colors.css). */
export interface MapTheme {
  /** empty field around and under the map */
  canvas: Paint
  grid: Paint
  /** the master's light grid line (blend mode 'screen') */
  gridContrast: Paint
  wall: Paint
  wallOutline: Paint
  barrier: Paint
  doorFill: Paint
  doorHover: Paint
  doorOutline: Paint
  /** CSS color of the door icon */
  doorIcon: string
  spawnFill: Paint
  spawnRing: Paint
  /** CSS color of the spawn icon */
  spawnIcon: string
  /** neutral marks of the tools: the fog brush circle */
  cursor: Paint
  fog: Paint
  /** fog in darkness */
  fogDark: Paint
  selection: Paint
  tokenFill: Paint
  tokenText: Paint
  /** the master's pencil (grey, like the master's icons) */
  master: Paint
  flow: Record<FlowColor, Paint>
}

const FLOW: FlowColor[] = ['red', 'orange', 'yellow', 'green', 'blue', 'indigo', 'purple', 'scarlett']

export function readTheme(el: Element = document.documentElement): MapTheme {
  const style = getComputedStyle(el)
  const css = (name: string) => style.getPropertyValue(name).trim()
  const paint = (name: string): Paint => {
    const c = new Color(css(name) || '#ff00ff')
    return { color: c.toNumber(), alpha: c.alpha }
  }
  return {
    canvas: paint('--bg-secondary'),
    grid: paint('--outline-primary'),
    gridContrast: paint('--txt-primary'),
    wall: paint('--outline-danger'),
    wallOutline: paint('--bg-secondary'),
    barrier: paint('--outline-brand'),
    doorFill: paint('--bg-primary'),
    doorHover: paint('--bg-alert'),
    doorOutline: paint('--outline-alert'),
    doorIcon: css('--icon-alert'),
    spawnFill: paint('--bg-info'),
    spawnRing: paint('--outline-brand'),
    spawnIcon: css('--icon-info'),
    cursor: paint('--txt-primary'),
    fog: paint('--bg-primary'),
    fogDark: paint('--bg-secondary'),
    selection: paint('--outline-brand'),
    tokenFill: paint('--bg-primary'),
    tokenText: paint('--txt-primary'),
    master: paint('--txt-secondary'),
    flow: Object.fromEntries(FLOW.map((f) => [f, paint(`--flow-${f}`)])) as Record<FlowColor, Paint>
  }
}
