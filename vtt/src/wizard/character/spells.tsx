// Step 9: cantrips and level 1 spells of the class.
import { abilityName, byId, nameOf, spellsFor, type SpellData } from '@app/data'
import { knownSpells } from '@app/rules/derive'
import type { Derived } from '@app/rules/derive'
import type { WizardState } from '@app/wizard/state'
import type { StepProps } from '@app/wizard/steps/common'
import { useStrings, type Catalog } from '../../i18n'
import { Fixed, PickMany, type Option } from '../fields'
import styles from '../Wizard.module.css'

const spellOption = (x: SpellData, t: Catalog['wizard']['char']): Option => ({
  value: x.id,
  label: nameOf(x),
  hint: [x.concentration && t.concentration, x.ritual && t.ritual].filter(Boolean).join(', ')
})

function counts(d: Derived) {
  const l1 = d.cls?.levels[0]
  const extra = d.order?.grants?.extra_cantrips || 0
  return {
    cantrips: l1?.cantrips ? l1.cantrips + extra : 0,
    prepared: l1?.prepared_spells || 0,
    spellbook: d.cls?.id === 'wizard' ? 6 : 0
  }
}

// spells the character gets without choosing them here (species, feats, class features)
function otherSpells(d: Derived, s: WizardState) {
  return knownSpells(d, { ...s, spells: { cantrips: [], prepared: [], spellbook: [] } })
}

export function SpellsStep({ s, d, set }: StepProps) {
  const t = useStrings().wizard.char
  const sc = d.cls?.spellcasting
  const other = otherSpells(d, s)
  const otherIds = new Set(other.map((k) => k.spell.id))
  const n = counts(d)
  const sp = s.spells
  const opt = (x: SpellData) => spellOption(x, t)

  if (!sc) {
    return (
      <div className={styles.stack}>
        <p className={styles.text}>{t.noSpells(nameOf(d.cls))}</p>
        {other.length > 0 && <Fixed label={t.otherSpells} value={other.map((k) => nameOf(k.spell))} />}
      </div>
    )
  }

  const cantripPool = spellsFor(sc.list, 0).filter((x) => !otherIds.has(x.id))
  const l1Pool = spellsFor(sc.list, 1).filter((x) => !otherIds.has(x.id))

  return (
    <div className={styles.stack}>
      <p className={styles.text}>{t.castingAbility} <span className={styles.strong}>{abilityName(sc.ability)}</span>.</p>
      {other.length > 0 && (
        <Fixed label={t.knownAlready} value={other.map((k) => nameOf(k.spell) + (k.source === 'species' ? ` (${t.bySpecies})` : k.source === 'feat' ? ` (${t.byFeat})` : ''))} />
      )}
      {n.cantrips > 0 && (
        <PickMany label={t.cantrips} data={cantripPool.map(opt)} max={n.cantrips} value={sp.cantrips} onChange={(v) => set('spells', { cantrips: v })} describe="spell" />
      )}
      {n.spellbook > 0 ? (
        <>
          <PickMany label={t.spellbook} data={l1Pool.map(opt)} max={n.spellbook} value={sp.spellbook} describe="spell"
            onChange={(v) => set('spells', { spellbook: v, prepared: sp.prepared.filter((id) => v.includes(id)) })} />
          <PickMany label={t.preparedFromBook} data={sp.spellbook.map((id) => opt(byId.spell[id]))} max={n.prepared} value={sp.prepared}
            onChange={(v) => set('spells', { prepared: v })} disabled={sp.spellbook.length === 0} describe="spell" />
        </>
      ) : (
        <PickMany label={t.prepared1} data={l1Pool.map(opt)} max={n.prepared} value={sp.prepared} onChange={(v) => set('spells', { prepared: v })} describe="spell" />
      )}
    </div>
  )
}

export function spellsValid(s: WizardState, d: Derived) {
  if (!d.cls?.spellcasting) return true
  const n = counts(d)
  const sp = s.spells
  return sp.cantrips.length === n.cantrips && sp.prepared.length === n.prepared && sp.spellbook.length === n.spellbook
}
