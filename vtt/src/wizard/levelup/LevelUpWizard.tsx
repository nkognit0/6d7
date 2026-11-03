// «Повысить уровень»: reads the sheet, offers what the next class level gives and writes the result
// back. The plan, the sheet reading and the writing are the old app's own (app/src/levelup).
import { useEffect, useMemo, useRef, useState } from 'react'
import type { DnDCharacter } from 'dnd-sheet'
import { nameOf } from '@app/data'
import { applyLevelUp } from '@app/levelup/apply'
import {
  choicesValid, emptyPicks, featChoices, featStepKind, featureChoices, hpGain, nextLevel, speciesLineageMissing, spellChoices, spellPlan,
  subclassStepNeeded, type ChoiceDef, type LevelPicks
} from '@app/levelup/plan'
import { readSheet, retarget, type SheetInfo } from '@app/levelup/read'
import { useHistory } from '@app/wizard/history'
import { useStrings, type Catalog } from '../../i18n'
import { Button } from '../../ui'
import { scrollTop, WizardFooter, WizardFrame } from '../Frame'
import { ClassStep, FeatStep, FeaturesStep, HpStep, SpellsStep, SubclassStep, SummaryStep, type LevelStepProps, type StepId } from './steps'
import styles from '../Wizard.module.css'

// the picks of each step, by key prefix; a step resets every step after it
const ORDER: StepId[] = ['class', 'hp', 'subclass', 'feat', 'features', 'spells', 'summary']
const PREFIX: Partial<Record<StepId, RegExp>> = { feat: /^ft(-x)?:/, features: /^[fsgm]:/, spells: /^sp:/ }

function resetAfter(p: LevelPicks, step: StepId): LevelPicks {
  const later = ORDER.slice(ORDER.indexOf(step) + 1)
  const next: LevelPicks = { ...p, choices: { ...p.choices } }
  if (later.includes('hp')) next.hp = { method: null, roll: null }
  if (later.includes('subclass')) next.subclass = null
  if (later.includes('feat')) next.feat = null
  for (const s of later) {
    const re = PREFIX[s]
    if (re) for (const k of Object.keys(next.choices)) if (re.test(k)) delete next.choices[k]
  }
  return next
}

function defsOf(step: StepId, info: SheetInfo, p: LevelPicks): ChoiceDef[] {
  if (step === 'feat') return featChoices(info, p)
  if (step === 'features') return featureChoices(info, p)
  if (step === 'spells') return spellChoices(info, p)
  return []
}

// drop picks that a changed choice made impossible (and choices that disappeared)
function sanitize(step: StepId, info: SheetInfo, p: LevelPicks): LevelPicks {
  const re = PREFIX[step]
  if (!re) return p
  let cur = p
  for (let pass = 0; pass < 3; pass++) {
    const defs = new Map(defsOf(step, info, cur).map((d) => [d.key, d]))
    const choices = { ...cur.choices }
    let changed = false
    for (const [k, v] of Object.entries(choices)) {
      if (!re.test(k)) continue
      const d = defs.get(k)
      const kept = d ? v.filter((x) => d.options.some((o) => o.value === x)).slice(0, d.count) : []
      if (kept.length !== v.length) {
        changed = true
        if (kept.length) choices[k] = kept
        else delete choices[k]
      }
    }
    if (!changed) return cur
    cur = { ...cur, choices }
  }
  return cur
}

interface StepDef {
  id: StepId
  title: string
  valid: boolean
}

function stepsFor(info: SheetInfo, p: LevelPicks, t: Catalog['wizard']['level']['steps']): StepDef[] {
  const kind = featStepKind(info)
  const out: StepDef[] = [{ id: 'class', title: t.cls, valid: true }, { id: 'hp', title: t.hp, valid: hpGain(info, p) != null }]
  if (subclassStepNeeded(info)) out.push({ id: 'subclass', title: t.subclass, valid: Boolean(p.subclass) })
  if (kind) out.push({ id: 'feat', title: kind === 'epic-boon' ? t.epicBoon : t.feat, valid: Boolean(p.feat) && choicesValid(featChoices(info, p), p) })
  out.push({ id: 'features', title: t.features, valid: !speciesLineageMissing(info) && choicesValid(featureChoices(info, p), p) })
  const plan = spellPlan(info, p)
  const spellDefs = spellChoices(info, p)
  if (spellDefs.length || plan?.automatic.length) out.push({ id: 'spells', title: t.spells, valid: choicesValid(spellDefs, p) })
  out.push({ id: 'summary', title: t.summary, valid: true })
  return out
}

/** goal: a higher-level start — the level the wizard takes the new sheet to, one level at a time. */
export function LevelUpWizard(props: { character: DnDCharacter; goal?: number | null; onClose: () => void; onComplete: (c: DnDCharacter) => void }) {
  const s = useStrings()
  const t = s.wizard.level
  const read = useMemo(() => readSheet(props.character), [props.character])
  const history = useHistory<LevelPicks>(emptyPicks)
  const picks = history.value
  const { change } = history
  const [active, setActive] = useState(0)
  const scrollRef = useRef<HTMLDivElement>(null)
  // the class that gains the level: the first class of the sheet, or the one picked on the first step
  const info = useMemo(() => (read.info ? retarget(read.info, picks.target) : null), [read, picks.target])

  const steps = info ? stepsFor(info, picks, t.steps) : []
  const firstOpen = steps.findIndex((x) => !x.valid)
  const maxStep = firstOpen === -1 ? steps.length - 1 : firstOpen
  const current = Math.min(active, maxStep)
  const step = steps[current]

  useEffect(() => {
    scrollTop(scrollRef.current)
  }, [current])

  const title = (info ? t.titleOf(nameOf(info.cls), nextLevel(info)) : t.title) + (props.goal ? ` ${t.startAt(props.goal)}` : '')

  if (!info) {
    return (
      <WizardFrame title={title} onClose={props.onClose} steps={[{ title: t.sheetIncomplete, done: false }]} current={0} maxStep={0} onStep={() => {}}
        footer={<WizardFooter main={<Button onClick={props.onClose}>{s.common.close}</Button>} />}>
        <div className={styles.danger}>
          <ul className={styles.list}>{read.errors.map((e) => <li key={e}>{e}</li>)}</ul>
        </div>
        <p className={styles.text}>{t.fixSheet}</p>
      </WizardFrame>
    )
  }

  const stepProps: LevelStepProps = {
    info,
    picks,
    update: (patch) => change((prev) => {
      const next = { ...prev, ...patch }
      return JSON.stringify(next) === JSON.stringify(prev) ? prev : resetAfter(next, step.id)
    }, current),
    choose: (key, values) => change((prev) => {
      if (JSON.stringify(prev.choices[key] || []) === JSON.stringify(values)) return prev
      const next = { ...prev, choices: { ...prev.choices, [key]: values } }
      if (!values.length) delete next.choices[key]
      return sanitize(step.id, info, resetAfter(next, step.id))
    }, current)
  }
  // starting over can be undone; undo and redo open the step where the change was made
  const reset = () => {
    change((prev) => (JSON.stringify(prev) === JSON.stringify(emptyPicks()) ? prev : emptyPicks()), current)
    setActive(0)
  }
  const show = (n: number | null) => n != null && setActive(n)
  const result = step.id === 'summary' ? applyLevelUp(props.character, info, picks) : null
  const last = current === steps.length - 1

  return (
    <WizardFrame
      title={title}
      onClose={props.onClose}
      steps={steps.map((st, i) => ({ title: st.title, done: i < maxStep && st.valid }))}
      current={current}
      maxStep={maxStep}
      onStep={setActive}
      scrollRef={scrollRef}
      footer={
        <WizardFooter
          onReset={reset}
          canUndo={history.canUndo}
          canRedo={history.canRedo}
          onUndo={() => show(history.undo())}
          onRedo={() => show(history.redo())}
          onBack={() => setActive(current - 1)}
          backDisabled={current === 0}
          main={last
            ? <Button onClick={() => result && props.onComplete(result.character)}>{t.finish}</Button>
            : <Button disabled={!step.valid} onClick={() => setActive(current + 1)}>{s.wizard.next}</Button>}
        />
      }
    >
      {current === 0 && read.warnings.map((w) => <p key={w} className={styles.alert}>{w}</p>)}
      {step.id === 'class' && <ClassStep {...stepProps} />}
      {step.id === 'hp' && <HpStep {...stepProps} />}
      {step.id === 'subclass' && <SubclassStep {...stepProps} />}
      {step.id === 'feat' && <FeatStep {...stepProps} />}
      {step.id === 'features' && <FeaturesStep {...stepProps} />}
      {step.id === 'spells' && <SpellsStep {...stepProps} />}
      {step.id === 'summary' && result && <SummaryStep summary={result.summary} warnings={read.warnings} />}
    </WizardFrame>
  )
}
