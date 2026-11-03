// Steps 4-5: rolling 4d6 six times and giving the results to the abilities.
import { ABILITIES, abilityName, nameOf, type Ability } from '@app/data'
import { rollAbilityScores } from '@app/rules/dice'
import { mod, signed } from '@app/rules/derive'
import type { Derived } from '@app/rules/derive'
import type { WizardState } from '@app/wizard/state'
import type { StepProps } from '@app/wizard/steps/common'
import { useStrings } from '../../i18n'
import { Button } from '../../ui'
import { Fixed, Pick } from '../fields'
import styles from '../Wizard.module.css'

export function RollStep({ s, set }: StepProps) {
  const t = useStrings().wizard.char
  const rolls = s.roll.rolls
  return (
    <div className={styles.stack}>
      <p className={styles.text}>{t.rollIntro}</p>
      <div className={styles.row}>
        <Button onClick={() => set('roll', { rolls: rollAbilityScores() })}>{rolls.length ? t.reroll : t.roll}</Button>
        {rolls.length > 0 && <p className={styles.muted}>{t.rerollHint}</p>}
      </div>
      {rolls.length > 0 && (
        <div className={styles.rolls}>
          {rolls.map((r, i) => {
            const droppedAt = r.dice.indexOf(r.dropped)
            return (
              <div key={i} className={styles.roll}>
                <span className={styles.rollTotal}>{r.total}</span>
                <span className={styles.dice}>
                  {r.dice.map((die, j) => <span key={j} className={j === droppedAt ? styles.dropped : undefined}>{die}</span>)}
                </span>
              </div>
            )
          })}
        </div>
      )}
      {rolls.length > 0 && <p className={styles.muted}>{t.rollSum(rolls.reduce((n, r) => n + r.total, 0))}</p>}
    </div>
  )
}

export const rollValid = (s: WizardState) => s.roll.rolls.length === 6

export function AbilitiesStep({ s, d, set }: StepProps) {
  const t = useStrings().wizard.char
  const { rolls } = s.roll
  const a = s.abilities
  const bg = d.bg
  const cls = d.cls
  const counts = new Map<number, number>()
  for (const r of rolls) counts.set(r.total, (counts.get(r.total) || 0) + 1)

  const usedBy = (i: number) => ABILITIES.find((x) => a.assign[x] === i)
  const assignData = (ab: Ability) =>
    rolls
      .map((r, i) => ({ r, i }))
      .filter(({ i }) => {
        const owner = usedBy(i)
        return !owner || owner === ab
      })
      .map(({ r, i }) => ({ value: String(i), label: (counts.get(r.total) || 0) > 1 ? t.rollOf(r.total, i + 1) : String(r.total) }))

  const bgAbilities = bg?.ability_scores || []
  const abilityOpts = (list: Ability[]) => list.map((x) => ({ value: x, label: abilityName(x) }))

  return (
    <div className={styles.stack}>
      {cls && (
        <p className={styles.text}>
          {t.primaryOf(nameOf(cls))}{' '}
          <span className={styles.strong}>{cls.primary_abilities.map(abilityName).join(cls.primary_ability_mode === 'any' ? t.or : t.and)}</span>.
        </p>
      )}
      <table className={styles.table}>
        <thead>
          <tr>
            <th>{t.ability}</th>
            <th>{t.rollColumn}</th>
            <th className={styles.center}>{t.bonus}</th>
            <th className={styles.center}>{t.total}</th>
            <th className={styles.center}>{t.modifier}</th>
          </tr>
        </thead>
        <tbody>
          {ABILITIES.map((ab) => {
            const base = d.base[ab]
            const total = base != null ? Math.min(20, base + d.bonus[ab]) : null
            return (
              <tr key={ab}>
                <td>{abilityName(ab)}</td>
                <td>
                  <Pick label="" data={assignData(ab)} value={a.assign[ab] != null ? String(a.assign[ab]) : null}
                    onChange={(v) => set('abilities', { assign: { ...a.assign, [ab]: v == null ? undefined : Number(v) } })} />
                </td>
                <td className={styles.center}>{d.bonus[ab] ? '+' + d.bonus[ab] : '—'}</td>
                <td className={styles.center}><span className={styles.strong}>{total ?? '—'}</span></td>
                <td className={styles.center}>{total != null ? signed(mod(total)) : '—'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <div className={styles.grid3}>
        <Pick label={t.bgBonus} data={[{ value: '2-1', label: t.plus21 }, { value: '1-1-1', label: t.plus111 }]} value={a.mode}
          onChange={(v) => set('abilities', { mode: v as WizardState['abilities']['mode'], plus2: null, plus1: null })} />
        {a.mode === '2-1' && (
          <>
            <Pick label={t.plus2} data={abilityOpts(bgAbilities)} value={a.plus2} describe="ability"
              onChange={(v) => set('abilities', { plus2: v as Ability, plus1: a.plus1 === v ? null : a.plus1 })} />
            <Pick label={t.plus1} data={abilityOpts(bgAbilities.filter((x) => x !== a.plus2))} value={a.plus1} describe="ability"
              onChange={(v) => set('abilities', { plus1: v as Ability })} />
          </>
        )}
        {a.mode === '1-1-1' && <Fixed label={t.plus1} value={bgAbilities.map(abilityName)} />}
      </div>
    </div>
  )
}

export function abilitiesValid(s: WizardState, _d: Derived) {
  const a = s.abilities
  if (!ABILITIES.every((x) => a.assign[x] != null)) return false
  if (a.mode === '1-1-1') return true
  return a.mode === '2-1' && Boolean(a.plus2 && a.plus1 && a.plus2 !== a.plus1)
}
