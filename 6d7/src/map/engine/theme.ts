import { Color } from 'pixi.js'
import type { FlowColor } from '../core/types'

/** A color of the design tokens split for Pixi: RGB number and alpha. */
export type Paint = { color: number; alpha: number }

/** Colors of the map, all taken from the design tokens (`--*` variables of colors.css). */
export interface MapTheme {
  /** empty field around and under the map */
  canvas: Paint
  /** the grid line over dark places of the map (white) and over light ones (black) */
  gridLight: Paint
  gridDark: Paint
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
  /** the spawn point when the map is zoomed out: solid bright blue */
  spawnSolid: Paint
  /** the fog brush circle: a white line with a black one outside, seen on any map */
  cursor: Paint
  cursorShadow: Paint
  fog: Paint
  /** fog in darkness */
  fogDark: Paint
  selection: Paint
  tokenFill: Paint
  tokenText: Paint
  /** the ring of an NPC (a player's is of the player's color) */
  tokenRing: Paint
  /** a zoomed-out NPC: a white disc with a black ring inside the grey one */
  tokenCompactFill: Paint
  tokenCompactLine: Paint
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
    gridLight: paint('--txt-button'),
    gridDark: paint('--icon-button'),
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
    spawnSolid: paint('--outline-brand'),
    cursor: paint('--txt-button'),
    cursorShadow: paint('--icon-button'),
    fog: paint('--bg-primary'),
    fogDark: paint('--bg-secondary'),
    selection: paint('--outline-brand'),
    tokenFill: paint('--bg-primary'),
    tokenText: paint('--txt-primary'),
    tokenRing: paint('--outline-primary'),
    tokenCompactFill: paint('--txt-button'),
    tokenCompactLine: paint('--icon-button'),
    master: paint('--txt-secondary'),
    flow: Object.fromEntries(FLOW.map((f) => [f, paint(`--flow-${f}`)])) as Record<FlowColor, Paint>
  }
}
