// «Короткий отдых»: how many hit dice the hero spends (none — only what a short rest restores by
// itself). The dice are rolled here; the rest itself is the rules package's (`shortRest`).
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { rollDie } from '@rules/rules/dice'
import { restState, shortRest, spentDice } from '@rules/rest/rest'
import { useStrings } from '../../i18n'
import { Button, Icon, IconButton, Modal, Overlay } from '../../ui'
import { characterOf, withCharacter, type Seat } from '../seat/seat'
import styles from './ShortRest.module.css'

export function ShortRestDialog({ seat, onChange, onMessage, onClose }: {
  seat: Seat
  onChange: (seat: Seat) => void
  onMessage: (text: string) => void
  onClose: () => void
}) {
  const s = useStrings()
  const c = characterOf(seat)
  const state = restState(c)
  const left = state.hitDice?.count ?? 0
  const [count, setCount] = useState(0)
  // the sizes of the dice spent, the largest first (several classes give several sizes)
  const dice = spentDice(c.hitDice, left)
  const sizes = [...new Set(dice)].map((d) => `к${d}`).join(', ')

  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', key)
    return () => document.removeEventListener('keydown', key)
  }, [onClose])

  const rest = () => {
    const rolls = dice.slice(0, count).map((d) => rollDie(d))
    const r = shortRest(c, rolls)
    const rolled = rolls.length ? s.rest.rolled(rolls.map((n, i) => `к${dice[i]}: ${n}`).join(', ')) : null
    onMessage([rolled, ...r.changes].filter(Boolean).join(' · ') || s.rest.nothingToRestore)
    onChange(withCharacter(seat, r.character))
    onClose()
  }

  return createPortal(
    <Overlay onClose={onClose} className={styles.center}>
      <Modal title={s.rest.short} onClose={onClose} className={styles.window}>
        <div className={styles.body}>
          {state.blocked ? (
            <p className={styles.text}>{state.blocked}</p>
          ) : (
            <>
              <p className={styles.text}>{s.rest.shortHint}</p>
              {state.hitDice ? (
                <div className={styles.dice}>
                  <span className={styles.label}>{s.rest.hitDice}</span>
                  <IconButton label={s.rest.fewer} icon={<Icon name="minus" />} disabled={count < 1} onClick={() => setCount(count - 1)} />
                  <span className={styles.count} aria-live="polite">{count}</span>
                  <IconButton label={s.rest.more} icon={<Icon name="plus" />} disabled={count >= left} onClick={() => setCount(count + 1)} />
                  <span className={styles.left}>{s.rest.ofLeft(left, sizes)}</span>
                </div>
              ) : (
                <p className={styles.text}>{s.rest.noHitDice}</p>
              )}
            </>
          )}
          <div className={styles.actions}>
            <Button variant="primary" onClick={onClose}>{s.common.cancel}</Button>
            <Button autoFocus disabled={!!state.blocked} onClick={rest}>{s.rest.restNow}</Button>
          </div>
        </div>
      </Modal>
    </Overlay>,
    document.body
  )
}
