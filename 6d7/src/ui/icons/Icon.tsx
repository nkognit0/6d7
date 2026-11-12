import type { CSSProperties } from 'react'
import geometry from './svg/geometry.json'
import styles from './Icon.module.css'

// every SVG from assets/ (copied by scripts/icons.mjs), keyed by "icon.16/search.svg"
const FILES = import.meta.glob('./svg/**/*.svg', { query: '?raw', import: 'default', eager: true }) as Record<string, string>
const svg = (path: string) => {
  const s = FILES[`./svg/${path}`]
  if (!s) throw new Error(`no icon ${path}`)
  return s
}
const GEOMETRY = geometry as Record<string, { w: number; h: number; x: number; y: number }>

/** One-color icons: their color comes from the layout (CSS color). */
export type IconName =
  | 'arrows.download' | 'arrows.import' | 'arrows.upload' | 'checkbox.checked' | 'chevron.down' | 'close'
  | 'door' | 'edit' | 'eraser' | 'fog.of.war' | 'home' | 'media.text' | 'minus' | 'more.three.dots' | 'play'
  | 'plus' | 'search' | 'wall.barrier' | 'wall.bricks'
export type Icon28Name = 'map' | 'autointent' | 'person.human.avatar' | 'settings'
/** Multicolored icons that stay as they are. */
export type ColorIconName = 'character.coin.P' | 'character.coin.G' | 'character.coin.S' | 'character.coin.M' | 'character.eraser'
/** The eight player colors (Figma flow/*) and grey for the master. */
export type PlayerColor = 'red' | 'orange' | 'yellow' | 'green' | 'blue' | 'indigo' | 'purple' | 'scarlett' | 'grey'
export const PLAYER_COLORS: PlayerColor[] = ['red', 'orange', 'yellow', 'green', 'blue', 'indigo', 'purple', 'scarlett']
export type PlayerIconName = 'character.figure.avatar' | 'character.pencil'
export type PlayerIcon42Name = 'sheet.character' | 'sheet.sidekick' | 'inventory' | 'spells' | 'dice'

type Base = { className?: string; style?: CSSProperties; title?: string }

function Mono({ path, size, className, style, title }: Base & { path: string; size: number }) {
  return (
    <span
      className={[styles.icon, className].filter(Boolean).join(' ')}
      style={{ width: size, height: size, ...style }}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      dangerouslySetInnerHTML={{ __html: svg(path) }}
    />
  )
}

// a colored icon: the file holds its shadows, so it is drawn bigger than the box and moved into place
function Shaded({ path, size, className, style, title }: Base & { path: string; size: number }) {
  const g = GEOMETRY[path]
  return (
    <span
      className={[styles.icon, styles.shaded, className].filter(Boolean).join(' ')}
      style={{ width: size, height: size, ...style }}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <span
        className={styles.file}
        style={{ width: g.w, height: g.h, left: -g.x, top: -g.y }}
        dangerouslySetInnerHTML={{ __html: svg(path) }}
      />
    </span>
  )
}

/** 16 px one-color UI icon. */
export function Icon({ name, ...rest }: Base & { name: IconName }) {
  return <Mono path={`icon.16/${name}.svg`} size={16} {...rest} />
}

/** 28 px one-color icon (editor navigation). */
export function Icon28({ name, ...rest }: Base & { name: Icon28Name }) {
  return <Mono path={`icon.28/${name}.svg`} size={28} {...rest} />
}

/** 16 px multicolored icon. */
export function ColorIcon({ name, ...rest }: Base & { name: ColorIconName }) {
  return <Shaded path={`icon.16.color/${name}.svg`} size={16} {...rest} />
}

/** 16 px icon in a player's color (grey for the master). */
export function PlayerIcon({ name, color, ...rest }: Base & { name: PlayerIconName; color: PlayerColor }) {
  return <Shaded path={`icon.16.player/${name}.${color}.svg`} size={16} {...rest} />
}

/** 42 px game navigation icon in a player's color (grey for the master). */
export function PlayerIcon42({ name, color, ...rest }: Base & { name: PlayerIcon42Name; color: PlayerColor }) {
  return <Shaded path={`icon.42.player/${name}.${color}.svg`} size={42} {...rest} />
}
