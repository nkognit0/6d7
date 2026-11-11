// The dice (D&D VTT / game / player 34:7783): the window next to the dice button and the log of
// rolls in the bottom right corner. The log lives only in the current game (QnA).
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { rollDie } from '@app/rules/dice'
import { useStrings } from '../../i18n'
import type { FlowColor } from '../../map'
import { Button, cx, Divider, Modal, Plate, RowField, Select, TextInput } from '../../ui'
import styles from './Player.module.css'

const DICE = [4, 6, 8, 10, 12, 20, 100] as const
const MAX_DICE = 99
// the gap between the window and its button (spacer-m)
const GAP = 8

export interface RollEntry {
  id: number
  name: string
  /** the player's color; the master's rolls are grey */
  color: FlowColor | 'master'
  count: number
  die: number
  total: number
}

export function DiceWindow({ anchor, above, onClose, onRoll }: {
  /** the dice button: the window opens on its right, at its height */
  anchor: HTMLElement | null
  /** the master: the window opens above the anchor (the plate of the dice and tokens), at its left edge */
  above?: boolean
  onClose: () => void
  onRoll: (roll: { count: number; die: number; total: number }) => void
}) {
  const s = useStrings()
  const [count, setCount] = useState('1')
  const [die, setDie] = useState('20')
  const [result, setResult] = useState<number | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)

  useLayoutEffect(() => {
    const a = anchor?.getBoundingClientRect()
    const h = ref.current?.offsetHeight ?? 0
    if (a && above) setPos({ left: a.left + GAP, top: Math.max(GAP, a.top - GAP - h) })
    else if (a) setPos({ left: a.right + GAP, top: Math.max(GAP, Math.min(a.top, innerHeight - h - GAP)) })
  }, [anchor, above])

  const roll = () => {
    const n = Math.max(1, Math.min(MAX_DICE, parseInt(count, 10) || 1))
    const sides = Number(die)
    let total = 0
    for (let i = 0; i < n; i++) total += rollDie(sides)
    setCount(String(n))
    setResult(total)
    onRoll({ count: n, die: sides, total })
  }

  return (
    <div ref={ref} className={styles.dice} style={pos ?? { visibility: 'hidden' }}>
      <Modal title={s.dice.title} onClose={onClose}>
        <RowField label={s.dice.count}>
          <TextInput value={count} inputMode="numeric" aria-label={s.dice.count} onChange={(e) => setCount(e.target.value.replace(/\D/g, '').slice(0, 2))}
            onKeyDown={(e) => e.key === 'Enter' && roll()} />
        </RowField>
        <RowField label={s.dice.kind}>
          <Select value={die} onChange={setDie} aria-label={s.dice.kind} options={DICE.map((d) => ({ value: String(d), label: `d${d}` }))} />
        </RowField>
        <Button stretch onClick={roll}>{s.dice.roll}</Button>
        <Divider />
        <div className={styles.result}>
          <span className={styles.resultLabel}>{s.dice.result}</span>
          <span className={styles.resultValue}>{result ?? '—'}</span>
        </div>
      </Modal>
    </div>
  )
}

/** The entries of the log: «Макар: 2d20 → 32», new ones at the bottom; it scrolls to the old ones. */
export function LogList({ entries, className }: { entries: RollEntry[]; className?: string }) {
  const s = useStrings()
  const list = useRef<HTMLDivElement>(null)
  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight })
  }, [entries])
  return (
    <div ref={list} className={cx(styles.logList, className)} role="log" aria-label={s.player.log}>
      {entries.map((e) => (
        <p key={e.id} className={styles.logEntry}>
          <span className={styles.logName} style={{ color: e.color === 'master' ? 'var(--txt-secondary)' : `var(--flow-${e.color})` }}>{e.name}:</span>{' '}
          {s.player.rollText(e.count, e.die)} → <span className={styles.logTotal}>{e.total}</span>
        </p>
      ))}
    </div>
  )
}

/** The log of a player: 240×130 in the bottom right corner of the map. */
export function LogPanel({ entries, className }: { entries: RollEntry[]; className?: string }) {
  return (
    <Plate edge={['right', 'bottom']} className={cx(styles.log, className)}>
      <LogList entries={entries} />
    </Plate>
  )
}

/** A roll of the dice window as an entry of the log. */
export const rollEntry = (name: string, color: RollEntry['color'], r: { count: number; die: number; total: number }): RollEntry => ({
  id: Date.now() + Math.random(), name, color, ...r
})
