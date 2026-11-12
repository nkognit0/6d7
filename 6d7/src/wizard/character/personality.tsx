// Step 11: free-form details. Only the name is required.
import { alignments, nameOf } from '@app/data'
import type { PersonalityState, WizardState } from '@app/wizard/state'
import type { StepProps } from '@app/wizard/steps/common'
import { useStrings } from '../../i18n'
import { AreaField, Pick, TextField } from '../fields'
import styles from '../Wizard.module.css'

export function PersonalityStep({ s, set }: StepProps) {
  const t = useStrings().wizard.char
  const p = s.personality
  // typing: undo takes back the whole edit of one field at once
  const put = (key: keyof PersonalityState) => (v: string) => set('personality', { [key]: v } as Partial<PersonalityState>, true)
  const text = (key: keyof PersonalityState, label: string, required = false) => (
    <TextField label={label} required={required} value={(p[key] as string) || ''} onChange={put(key)} />
  )
  const area = (key: keyof PersonalityState, label: string, rows = 2) => (
    <AreaField label={label} rows={rows} value={(p[key] as string) || ''} onChange={put(key)} />
  )
  return (
    <div className={styles.stack}>
      <div className={styles.grid2}>
        {text('name', t.name, true)}
        {text('playerName', t.playerName)}
        <Pick label={t.alignment} data={alignments.filter((a) => a.selectable).map((a) => ({ value: a.id, label: nameOf(a) }))}
          value={p.alignment} onChange={(v) => set('personality', { alignment: v })} describe="alignment" />
        {text('deity', t.deity)}
      </div>
      <div className={styles.grid3}>
        {text('age', t.age)}
        {text('height', t.height)}
        {text('weight', t.weight)}
        {text('eyes', t.eyes)}
        {text('skin', t.skin)}
        {text('hair', t.hair)}
      </div>
      <div className={styles.grid2}>
        {area('traits', t.traits)}
        {area('ideals', t.ideals)}
        {area('bonds', t.bonds)}
        {area('flaws', t.flaws)}
      </div>
      {area('backstory', t.backstory, 3)}
    </div>
  )
}

export const personalityValid = (s: WizardState) => s.personality.name.trim().length > 0
