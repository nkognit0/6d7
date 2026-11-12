// Step 12: everything the wizard computed, before the sheet is filled.
import { ABILITIES, abilityName, nameOf, skills } from '@app/data'
import { mod, signed } from '@app/rules/derive'
import { SKILL_FIELD, buildCharacter } from '@app/rules/sheet'
import type { StepProps } from '@app/wizard/steps/common'
import { useStrings } from '../../i18n'
import styles from '../Wizard.module.css'

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className={styles.stat} title={hint}>
      <span className={styles.muted}>{label}</span>
      <span className={styles.statValue}>{value || '—'}</span>
    </div>
  )
}

export function SummaryStep({ s }: StepProps) {
  const t = useStrings().wizard.char
  const { character: c, acFormula, warnings, derived: d } = buildCharacter(s)
  const skillRows = skills.filter((x) => d.skills.has(x.id))
  const money = [c.gp && t.gp(Number(c.gp)), c.sp && t.sp(Number(c.sp)), c.cp && t.cp(Number(c.cp))].filter(Boolean).join(', ') || t.gp(0)
  return (
    <div className={styles.stack}>
      <h4 className={styles.boxTitle}>{c.name} — {c.classLevel}, {c.species}, {c.background}</h4>
      {warnings.map((w) => <p key={w} className={styles.alert}>{w}</p>)}
      <div className={styles.stats}>
        <Stat label={t.hp} value={String(c.maxHp || '')} />
        <Stat label={t.ac} value={String(c.ac || '')} hint={acFormula} />
        <Stat label={t.initiative} value={String(c.init || '')} />
        <Stat label={t.speed} value={String(c.speed || '')} />
        <Stat label={t.proficiency} value={String(c.proficiencyBonus || '')} />
        <Stat label={t.passivePerception} value={String(c.passivePerception || '')} />
      </div>
      <p className={styles.muted}>{t.acFormula(acFormula)}</p>
      <div className={styles.columns}>
        <table className={styles.table}>
          <thead>
            <tr><th>{t.ability}</th><th className={styles.center}>{t.value}</th><th className={styles.center}>{t.save}</th></tr>
          </thead>
          <tbody>
            {ABILITIES.map((a) => (
              <tr key={a}>
                <td>{abilityName(a)}</td>
                <td className={styles.center}>{String(c[a])} ({signed(mod(Number(c[a])))})</td>
                <td className={styles.center}>{c[a + 'SaveChecked'] ? <span className={styles.strong}>{String(c[a + 'Save'])}</span> : String(c[a + 'Save'])}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <table className={styles.table}>
          <thead>
            <tr><th>{t.skillProficient}</th><th className={styles.center}>{t.bonus}</th></tr>
          </thead>
          <tbody>
            {skillRows.map((x) => (
              <tr key={x.id}>
                <td>{nameOf(x)}{d.expertise.has(x.id) ? ` (${t.expertiseMark})` : ''}</td>
                <td className={styles.center}>{String(c[SKILL_FIELD[x.id]])}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {(c.attacks?.length || 0) > 0 && (
        <table className={styles.table}>
          <thead>
            <tr><th>{t.attack}</th><th>{t.bonusOrDc}</th><th>{t.damage}</th><th>{t.notes}</th></tr>
          </thead>
          <tbody>
            {c.attacks!.map((r, i) => (
              <tr key={i}><td>{r.name}</td><td>{r.bonus}</td><td>{r.damage}</td><td>{r.notes}</td></tr>
            ))}
          </tbody>
        </table>
      )}
      {c.spellcastingClass && (
        <p className={styles.text}>{t.spellcasting(String(c.spellcastingClass), String(c.spellSaveDC), String(c.spellAttackBonus), Number(c.lvl1SpellSlotsTotal) || 0)}</p>
      )}
      <p className={styles.text}>{t.moneyAndLanguages(money, String(c.languages ?? ''))}</p>
      <p className={styles.muted}>{t.summaryNote}</p>
    </div>
  )
}
