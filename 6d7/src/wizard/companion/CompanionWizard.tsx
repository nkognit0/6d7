// The companion wizards. «Создать спутника»: the kind of companion the rules give this character,
// its form (and the creature type of a steed, the spell slot of a spell), its name. «Повысить
// уровень спутника»: the companion follows its owner's class level or a higher spell slot. The
// rules are the old app's own (app/src/companion).
import { useMemo, useState } from 'react'
import type { DnDCharacter } from 'dnd-sheet'
import { nameOf } from '@app/data'
import {
  accessOf, buildCompanion, companionKinds, creatureById, creatureTypeName, formsOf, kindById, levelUpCompanion, ownerOf, scaleOf,
  type CompanionSheet
} from '@app/companion/companion'
import { useStrings } from '../../i18n'
import { Button } from '../../ui'
import { Fixed, Pick, TextField } from '../fields'
import { WizardFooter, WizardFrame } from '../Frame'
import styles from '../Wizard.module.css'

interface Picks {
  kind: string | null
  creature: string | null
  type: string | null
  scale: number | null
  name: string
}
const EMPTY: Picks = { kind: null, creature: null, type: null, scale: null, name: '' }

function StatsPreview({ s }: { s: CompanionSheet }) {
  const t = useStrings().wizard.companion
  return (
    <div className={styles.box}>
      <h4 className={styles.boxTitle}>{String(s.name)} — {String(s.form)}</h4>
      <p className={styles.muted}>{[s.size, s.creatureType, s.alignment].filter(Boolean).join(', ')}</p>
      <p className={styles.text}>{t.stats(String(s.ac), String(s.maxHp), String(s.hitDice), String(s.speed))}</p>
      {s.senses ? <p className={styles.text}>{t.senses(String(s.senses))}</p> : null}
      <p className={styles.text}>{String(s.actions || '')}</p>
    </div>
  )
}

const slotRange = (min: number, max: number) => Array.from({ length: max - min + 1 }, (_, i) => min + i)

export function CompanionWizard(props: { character: DnDCharacter; onClose: () => void; onComplete: (s: CompanionSheet) => void }) {
  const s = useStrings()
  const t = s.wizard.companion
  const owner = useMemo(() => ownerOf(props.character), [props.character])
  const [p, setP] = useState<Picks>(EMPTY)
  const [step, setStep] = useState(0)
  const kind = p.kind ? kindById[p.kind] : null
  const forms = kind ? formsOf(owner, kind) : []
  const scale = kind ? scaleOf(owner, kind) : null
  const needType = !!(p.creature && creatureById[p.creature]?.type_by_choice && kind?.type_choice)
  const valid = [Boolean(kind), Boolean(p.creature) && (!needType || Boolean(p.type)), true, true]
  const maxStep = valid.findIndex((v) => !v) === -1 ? 3 : valid.findIndex((v) => !v)
  const current = Math.min(step, maxStep)
  const result = kind && p.creature ? buildCompanion(owner, { kind: kind.id, creature: p.creature, type: p.type, scale: p.scale, name: p.name.trim() }) : null

  const kinds = companionKinds.map((k) => {
    const ok = accessOf(owner, k).length > 0
    return { value: k.id, label: nameOf(k), disabled: !ok, hint: ok ? undefined : t.notByRules }
  })
  const slots = scale?.variable === 'slot' ? slotRange(scale.min, scale.max) : []
  const titles = [t.steps.kind, t.steps.form, t.steps.name, t.steps.summary]

  return (
    <WizardFrame title={t.title} onClose={props.onClose} steps={titles.map((title, i) => ({ title, done: i < maxStep }))} current={current} maxStep={maxStep} onStep={setStep}
      footer={
        <WizardFooter onBack={() => setStep(current - 1)} backDisabled={current === 0}
          main={current === 3
            ? <Button onClick={() => result && props.onComplete(result)}>{t.finish}</Button>
            : <Button disabled={!valid[current]} onClick={() => setStep(current + 1)}>{s.wizard.next}</Button>} />
      }>
      {current === 0 && (
        <div className={styles.stack}>
          <p className={styles.text}>{t.kindIntro}</p>
          <Pick label={t.companion} data={kinds} value={p.kind} onChange={(v) => setP({ ...EMPTY, kind: v })} describe="companion" />
          {kind && (
            <div className={styles.box}>
              <h4 className={styles.boxTitle}>{t.whyAvailable}</h4>
              <ul className={styles.list}>{accessOf(owner, kind).map((a) => <li key={a.how_ru}>{a.how_ru}</li>)}</ul>
            </div>
          )}
          {!kinds.some((k) => !k.disabled) && <p className={styles.alert}>{t.noneAvailable}</p>}
        </div>
      )}
      {current === 1 && kind && (
        <div className={styles.stack}>
          {kind.appearance_ru && <p className={styles.text}>{kind.appearance_ru}</p>}
          <Pick label={t.form} data={forms.map((id) => ({ value: id, label: nameOf(creatureById[id]) }))} value={p.creature}
            onChange={(v) => setP({ ...p, creature: v, type: null })} describe="creature" />
          {needType && (
            <Pick label={t.creatureType} data={kind.type_choice!.options.map((x) => ({ value: x, label: creatureTypeName(x) }))} value={p.type}
              onChange={(v) => setP({ ...p, type: v })} />
          )}
          {scale?.variable === 'slot' && (
            <Pick label={t.slot} description={t.slotHint} data={slots.map((l) => ({ value: String(l), label: t.circle(l) }))} value={String(p.scale ?? scale.value)}
              onChange={(v) => setP({ ...p, scale: v ? Number(v) : null })} />
          )}
          {scale?.variable === 'level' && <Fixed label={t.growsWithLevel} value={t.levelN(scale.value)} />}
        </div>
      )}
      {current === 2 && (
        <div className={styles.stack}>
          <TextField label={t.name} placeholder={p.creature ? nameOf(creatureById[p.creature]) : ''} value={p.name} onChange={(v) => setP({ ...p, name: v })} />
          <p className={styles.muted}>{t.pictureHint}</p>
        </div>
      )}
      {current === 3 && result && <StatsPreview s={result} />}
    </WizardFrame>
  )
}

export function CompanionLevelUp(props: { character: DnDCharacter; companion: CompanionSheet; onClose: () => void; onComplete: (s: CompanionSheet) => void }) {
  const s = useStrings()
  const t = s.wizard.companion
  const owner = useMemo(() => ownerOf(props.character), [props.character])
  const kind = kindById[String(props.companion.kind)]
  const scale = kind ? scaleOf(owner, kind) : null
  const [slot, setSlot] = useState<number | null>(null)
  if (!kind || !scale) {
    return (
      <WizardFrame title={t.levelTitle(String(props.companion.name ?? ''))} onClose={props.onClose} steps={[{ title: t.steps.level, done: false }]} current={0} maxStep={0} onStep={() => {}}
        footer={<WizardFooter main={<Button onClick={props.onClose}>{s.common.close}</Button>} />}>
        <p className={styles.text}>{kind ? t.doesNotGrow(nameOf(kind)) : t.notFromBase}</p>
      </WizardFrame>
    )
  }
  const value = scale.variable === 'slot' ? (slot ?? scale.max) : scale.value
  const r = levelUpCompanion(props.companion, owner, value)
  const slots = scale.variable === 'slot' ? slotRange(scale.min, scale.max) : []
  return (
    <WizardFrame title={t.levelTitle(String(props.companion.name ?? ''))} onClose={props.onClose} steps={[{ title: t.steps.level, done: false }]} current={0} maxStep={0} onStep={() => {}}
      footer={
        <WizardFooter main={<>
          <Button variant="primary" onClick={props.onClose}>{s.common.cancel}</Button>
          <Button disabled={!r.changes.length} onClick={() => props.onComplete(r.sheet)}>{s.common.save}</Button>
        </>} />
      }>
      <div className={styles.stack}>
        {scale.variable === 'level'
          ? <p className={styles.text}>{t.growsNow(nameOf(kind), scale.value, props.companion.scale ? String(props.companion.scale) : null)}</p>
          : <Pick label={t.slot} description={t.slotLevelHint} data={slots.map((l) => ({ value: String(l), label: t.circle(l) }))} value={String(value)}
              onChange={(v) => setSlot(v ? Number(v) : null)} />}
        {r.changes.length
          ? <div className={styles.box}><ul className={styles.list}>{r.changes.map((c) => <li key={c}>{c}</li>)}</ul></div>
          : <p className={styles.muted}>{t.nothingChanges}</p>}
      </div>
    </WizardFrame>
  )
}
