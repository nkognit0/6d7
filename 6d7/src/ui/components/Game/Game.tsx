import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { ColorIcon, PlayerIcon42, type PlayerColor, type PlayerIcon42Name } from '../../icons/Icon'
import { cx, stateAttr, type PreviewState } from '../../lib'
import { Checkbox } from '../Checkbox/Checkbox'
import { Switch } from '../Switch/Switch'
import styles from './Game.module.css'

/** D&D 2024 coins in the app: платиновые, золотые, серебряные, медные (no electrum). */
export type Coin = 'pp' | 'gp' | 'sp' | 'cp'
const COIN_ICON = { pp: 'character.coin.P', gp: 'character.coin.G', sp: 'character.coin.S', cp: 'character.coin.M' } as const
const COIN_NAME = { pp: 'Платиновые монеты', gp: 'Золотые монеты', sp: 'Серебряные монеты', cp: 'Медные монеты' } as const

/** D&D VTT / game / inventory (34:6919): a coin with its amount. */
export function CoinValue({ coin, value }: { coin: Coin; value: number }) {
  return (
    <span className={styles.coin} title={COIN_NAME[coin]}>
      <ColorIcon name={COIN_ICON[coin]} />
      <span className={styles.coinValue}>{value}</span>
    </span>
  )
}

/** D&D VTT / game / spell slots (34:7386): circle number and its slot checkboxes. */
export function SpellSlotRow({ level, used, total, onChange }: {
  level: number
  /** how many slots are spent */
  used: number
  /** slots of this circle (1–4) */
  total: number
  onChange?: (used: number) => void
}) {
  return (
    <div className={styles.slotRow}>
      <span className={styles.slotLevel}>{level}</span>
      {Array.from({ length: total }, (_, i) => (
        <Checkbox key={i} checked={i < used} aria-label={`Ячейка ${level}-го круга ${i + 1}`}
          onChange={(on) => onChange?.(on ? i + 1 : i)} />
      ))}
    </div>
  )
}

/** D&D VTT / editor / rules (41:4128): a campaign setting — name, explanation and a switch. */
export function SettingRow({ title, description, checked, onChange, disabled }: {
  title: string
  description: string
  checked: boolean
  onChange?: (checked: boolean) => void
  disabled?: boolean
}) {
  return (
    <label className={styles.setting}>
      <span className={styles.settingText}>
        <span className={styles.settingTitle}>{title}</span>
        <span className={styles.settingDescription}>{description}</span>
      </span>
      <Switch checked={checked} onChange={onChange} disabled={disabled} aria-label={title} />
    </label>
  )
}

/** D&D VTT / editor / players (14:1568): avatar, name field, invite code and a remove button. */
export function PlayerRow({ avatar, name, code, action }: { avatar: ReactNode; name: ReactNode; code: ReactNode; action?: ReactNode }) {
  return (
    <div className={styles.player}>
      {avatar}
      <span className={styles.playerName}>{name}</span>
      <span className={styles.playerCode}>{code}</span>
      {action}
    </div>
  )
}

/**
 * D&D VTT / assets / menu (28:434): the 58 px game navigation button with a 42 px icon in the
 * player's color (grey for the master). `open` keeps the active look while its window is open.
 */
export function GameMenuButton({ icon, color, label, open, previewState, className, type = 'button', ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & {
  icon: PlayerIcon42Name
  color: PlayerColor
  label: string
  open?: boolean
  previewState?: Extract<PreviewState, 'hover'>
}) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      aria-pressed={!!open}
      className={cx(styles.menuButton, className)}
      {...stateAttr(previewState)}
      {...rest}
    >
      <PlayerIcon42 name={icon} color={color} />
    </button>
  )
}

/**
 * D&D VTT: the dark plates that hold floating game controls (player navigation on the left,
 * tools on the right, the master's player menu and action cluster). `edge` is the side of the
 * screen the plate touches, or two sides for a corner: there the plate has no line and its outer
 * corners stay square.
 */
type PlateEdge = 'left' | 'right' | 'top' | 'bottom'
const EDGE_CLASS = { left: styles.edgeLeft, right: styles.edgeRight, top: styles.edgeTop, bottom: styles.edgeBottom }

export function Plate({ children, edge, direction = 'column', className }: {
  children: ReactNode
  edge?: PlateEdge | PlateEdge[]
  direction?: 'column' | 'row'
  className?: string
}) {
  const edges = edge == null ? [] : Array.isArray(edge) ? edge : [edge]
  return <div className={cx(styles.plate, styles[direction], ...edges.map((e) => EDGE_CLASS[e]), className)}>{children}</div>
}
