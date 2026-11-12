// «Создать лист»: the character wizard of the old app (the same steps and rules), in the styles of
// the VTT. The rules logic — derive, the sheet, the history — is the old app's own.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { DnDCharacter } from 'dnd-sheet'
import { derive, type Derived } from '@app/rules/derive'
import { buildCharacter } from '@app/rules/sheet'
import { useHistory } from '@app/wizard/history'
import { applyUpdate, initialState, type StepKey, type WizardState } from '@app/wizard/state'
import type { StepProps } from '@app/wizard/steps/common'
import { useStrings, type Catalog } from '../../i18n'
import { Button } from '../../ui'
import { scrollTop, WizardFooter, WizardFrame } from '../Frame'
import { abilitiesValid, AbilitiesStep, RollStep, rollValid } from './abilities'
import { EquipmentStep, equipmentValid } from './equipment'
import { BackgroundStep, backgroundValid, ClassStep, classValid, SpeciesStep, speciesValid } from './origin'
import { PersonalityStep, personalityValid } from './personality'
import { FeaturesStep, featuresValid, FeatsStep, featsValid, SkillsStep, skillsValid } from './proficiencies'
import { SpellsStep, spellsValid } from './spells'
import { SummaryStep } from './summary'

interface StepDef {
  title: (t: Catalog['wizard']['char']['steps']) => string
  Comp: (p: StepProps) => JSX.Element | null
  valid: (s: WizardState, d: Derived) => boolean
}

const STEPS: StepDef[] = [
  { title: (t) => t.cls, Comp: ClassStep, valid: classValid },
  { title: (t) => t.background, Comp: BackgroundStep, valid: backgroundValid },
  { title: (t) => t.species, Comp: SpeciesStep, valid: speciesValid },
  { title: (t) => t.roll, Comp: RollStep, valid: rollValid },
  { title: (t) => t.abilities, Comp: AbilitiesStep, valid: abilitiesValid },
  { title: (t) => t.feats, Comp: FeatsStep, valid: featsValid },
  { title: (t) => t.skills, Comp: SkillsStep, valid: skillsValid },
  { title: (t) => t.features, Comp: FeaturesStep, valid: featuresValid },
  { title: (t) => t.spells, Comp: SpellsStep, valid: spellsValid },
  { title: (t) => t.equipment, Comp: EquipmentStep, valid: equipmentValid },
  { title: (t) => t.personality, Comp: PersonalityStep, valid: personalityValid },
  { title: (t) => t.summary, Comp: SummaryStep, valid: () => true }
]

/**
 * `opened: false` hides the wizard but keeps its choices until it is opened again. onComplete gets
 * the level 1 sheet and the level the game starts at (the level-up wizard takes it there).
 */
export function CharacterWizard(props: { opened: boolean; onClose: () => void; onComplete: (c: DnDCharacter, startLevel: number) => void }) {
  const s = useStrings()
  const t = s.wizard.char
  const history = useHistory<WizardState>(initialState)
  const state = history.value
  const [active, setActive] = useState(0)
  const d = useMemo(() => derive(state), [state])
  const scrollRef = useRef<HTMLDivElement>(null)
  // the step on screen, for the history to know where a change was made
  const currentRef = useRef(0)

  // a step can be opened when every step before it is complete
  const validity = STEPS.map((st) => st.valid(state, d))
  const firstOpen = validity.findIndex((v) => !v)
  const maxStep = firstOpen === -1 ? STEPS.length - 1 : firstOpen

  const { change } = history
  const set = useCallback(<K extends StepKey>(key: K, patch: Partial<WizardState[K]>, typing?: boolean) => {
    change((prev) => applyUpdate(prev, key, patch), currentRef.current, typing ? key + ':' + Object.keys(patch).join() : undefined)
  }, [change])

  // starting over is an action too, so it can be undone
  const reset = () => {
    change((prev) => (JSON.stringify(prev) === JSON.stringify(initialState()) ? prev : initialState()), currentRef.current)
    setActive(0)
  }

  const finish = () => {
    props.onComplete(buildCharacter(state).character, state.cls.startLevel)
    history.clear(initialState())
    setActive(0)
  }

  // undo and redo open the step where the change was made
  const show = (step: number | null) => step != null && setActive(step)

  const current = Math.min(active, maxStep)
  currentRef.current = current
  const Comp = STEPS[current].Comp
  const last = current === STEPS.length - 1

  useEffect(() => {
    scrollTop(scrollRef.current)
  }, [current])

  if (!props.opened) return null
  return (
    <WizardFrame
      title={t.title}
      onClose={props.onClose}
      steps={STEPS.map((st, i) => ({ title: st.title(t.steps), done: i < maxStep && validity[i] }))}
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
            ? <Button onClick={finish}>{t.finish}</Button>
            : <Button disabled={!validity[current]} onClick={() => setActive(current + 1)}>{s.wizard.next}</Button>}
        />
      }
    >
      <Comp s={state} d={d} set={set} />
    </WizardFrame>
  )
}
