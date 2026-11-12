// Steps 6-8: origin feat choices, skills / tools / languages, level 1 class choices.
import {
  abilityName, byId, categoryItems, classFeatures, classOptions, fightingStyles, languages, nameOf, ruName, skills, spellsFor, toolItems, weapons
} from '@app/data'
import type { ClassChoice } from '@app/data'
import type { Derived, FeatSlot } from '@app/rules/derive'
import { invocationName } from '@app/rules/text'
import type { FeatPicks, WizardState } from '@app/wizard/state'
import type { StepProps } from '@app/wizard/steps/common'
import { useStrings } from '../../i18n'
import { skillOrTool, useDescribe } from '../describe'
import { FeatureList, Fixed, Pick, PickMany, options } from '../fields'
import styles from '../Wizard.module.css'

const skillName = (id: string) => nameOf(byId.skill[id])
const itemName = (id: string) => nameOf(byId.item[id])

// ---------------------------------------------------------------- origin feats

// skills and tools known before the feat step, not counting the given slot
function knownBeforeFeats(d: Derived, s: WizardState, except: FeatSlot['slot']) {
  const skillSet = new Set<string>(d.bg?.skill_proficiencies || [])
  for (const id of s.species.skills) skillSet.add(id)
  const toolSet = new Set<string>([...(d.bg?.tool_proficiencies.fixed || []), ...s.background.toolChoice])
  if (s.species.tool) toolSet.add(s.species.tool)
  for (const slot of d.featSlots) {
    if (slot.slot === except) continue
    for (const p of slot.picks.picks) {
      if (p.startsWith('skill:')) skillSet.add(p.slice(6))
      else if (p.startsWith('tool:')) toolSet.add(p.slice(5))
      else toolSet.add(p)
    }
  }
  return { skillSet, toolSet }
}

function FeatCard({ slot, s, d, set }: StepProps & { slot: FeatSlot }) {
  const t = useStrings().wizard.char
  const p = slot.picks
  const update = (patch: Partial<FeatPicks>) => set('feats', { [slot.slot]: { ...p, ...patch } } as Partial<WizardState['feats']>)
  const { skillSet, toolSet } = knownBeforeFeats(d, s, slot.slot)
  const from = slot.slot === 'background' ? t.fromBackground : t.fromSpecies
  const { show } = useDescribe()
  let body: JSX.Element
  switch (slot.feat.id) {
    case 'skilled': {
      const data = [
        { group: t.skills, items: skills.filter((x) => !skillSet.has(x.id)).map((x) => ({ value: 'skill:' + x.id, label: nameOf(x) })) },
        { group: t.tools, items: toolItems.filter((x) => !toolSet.has(x.id)).map((x) => ({ value: 'tool:' + x.id, label: nameOf(x) })) }
      ]
      body = <PickMany label={t.skillsOrTools} data={data} max={3} value={p.picks} onChange={(v) => update({ picks: v })} describe={skillOrTool} />
      break
    }
    case 'magic-initiate': {
      const other = d.featSlots.find((x) => x.slot !== slot.slot && x.feat.id === 'magic-initiate')
      const otherList = other ? other.fixedList || other.picks.spellList : null
      const list = slot.fixedList || p.spellList
      body = (
        <div className={styles.grid2}>
          <Pick label={t.spellList} data={['cleric', 'druid', 'wizard'].filter((x) => x !== otherList).map((x) => ({ value: x, label: ruName('classes', x) }))}
            value={list} onChange={(v) => update({ spellList: v, cantrips: [], spell: null })} describe="class" disabled={Boolean(slot.fixedList)} />
          <Pick label={t.spellAbility} data={(['int', 'wis', 'cha'] as const).map((a) => ({ value: a, label: abilityName(a) }))}
            value={p.ability} onChange={(v) => update({ ability: v as FeatPicks['ability'] })} describe="ability" />
          <PickMany label={t.cantrips} data={list ? options(spellsFor(list, 0), (x) => x.id, (x) => nameOf(x)) : []} max={2}
            value={p.cantrips} onChange={(v) => update({ cantrips: v })} describe="spell" disabled={!list} />
          <Pick label={t.level1Spell} data={list ? options(spellsFor(list, 1), (x) => x.id, (x) => nameOf(x)) : []}
            value={p.spell} onChange={(v) => update({ spell: v })} describe="spell" disabled={!list} />
        </div>
      )
      break
    }
    case 'crafter':
    case 'musician': {
      const choice = slot.feat.choices?.find((c) => c.type === 'tool')
      const pool = Array.isArray(choice?.from) ? choice!.from : (choice?.from_categories || []).flatMap((c) => categoryItems(c).map((x) => x.id))
      body = (
        <PickMany label={t.tools} data={options(pool.filter((id) => !toolSet.has(id)), (id) => id, itemName)} max={choice?.count || 3}
          value={p.picks} onChange={(v) => update({ picks: v })} describe="item" />
      )
      break
    }
    default:
      body = <p className={styles.muted}>{t.featNoChoice}</p>
  }
  return (
    <div className={styles.box}>
      <h4 className={styles.boxTitle} onMouseEnter={() => show({ kind: 'feat', id: slot.feat.id })}>
        {nameOf(slot.feat)} <span className={styles.muted}>({from})</span>
      </h4>
      {body}
    </div>
  )
}

export function FeatsStep(props: StepProps) {
  return (
    <div className={styles.stack}>
      {props.d.featSlots.map((slot) => <FeatCard key={slot.slot} slot={slot} {...props} />)}
    </div>
  )
}

function featSlotValid(slot: FeatSlot) {
  const p = slot.picks
  switch (slot.feat.id) {
    case 'skilled':
      return p.picks.length === 3
    case 'magic-initiate':
      return Boolean((slot.fixedList || p.spellList) && p.ability && p.cantrips.length === 2 && p.spell)
    case 'crafter':
    case 'musician':
      return p.picks.length === (slot.feat.choices?.find((c) => c.type === 'tool')?.count || 3)
    default:
      return true
  }
}

export const featsValid = (_s: WizardState, d: Derived) => d.featSlots.every(featSlotValid)

// ---------------------------------------------------------------- skills, tools, languages

function skillPool(d: Derived, known: Set<string>) {
  const group = d.cls?.skill_proficiencies.choose[0]
  if (!group) return { count: 0, pool: [] as string[] }
  const listed = group.from === 'any' || !group.from ? skills.map((x) => x.id) : group.from
  let pool = listed.filter((id) => !known.has(id))
  // if almost everything is already known, any skill may be taken instead
  if (pool.length < group.count) pool = skills.map((x) => x.id).filter((id) => !known.has(id))
  return { count: group.count, pool }
}

function knownBeforeClass(d: Derived, s: WizardState) {
  const skillsKnown = new Map(d.skills)
  for (const id of s.skills.classSkills) skillsKnown.delete(id)
  const toolsKnown = new Map(d.tools)
  for (const id of s.skills.classTools) toolsKnown.delete(id)
  return { skillsKnown, toolsKnown }
}

const choiceOf = (d: Derived, type: ClassChoice['type']) => d.cls?.level_1_choices.find((c) => c.type === type)

export function SkillsStep({ s, d, set }: StepProps) {
  const t = useStrings().wizard.char
  const cls = d.cls!
  const { skillsKnown, toolsKnown } = knownBeforeClass(d, s)
  const { count, pool } = skillPool(d, new Set(skillsKnown.keys()))
  const expertise = choiceOf(d, 'expertise')
  const extraLang = choiceOf(d, 'language')
  const proficient = [...skillsKnown.keys(), ...s.skills.classSkills]
  const classLangs = cls.languages.fixed || []
  const knownLangs = new Set(['common', ...classLangs, ...s.skills.languages])
  const toolGroups = cls.tool_proficiencies.choose
  const toolPool = toolGroups.flatMap((g) => (g.from_categories || []).flatMap((c) => categoryItems(c).map((x) => x.id)))
  // «класс» — how the rules logic names the class as a source of a tool
  const otherTools = [...toolsKnown.entries()].filter(([, src]) => src !== 'класс')

  return (
    <div className={styles.stack}>
      <Fixed label={t.skillsKnown} value={[...skillsKnown.entries()].map(([id, src]) => `${skillName(id)} (${src})`)} />
      <PickMany label={t.classSkills} data={options(pool, (id) => id, skillName)} max={count} value={s.skills.classSkills} describe="skill"
        onChange={(v) => set('skills', { classSkills: v, expertise: s.skills.expertise.filter((x) => skillsKnown.has(x) || v.includes(x)) })} />
      {expertise && (
        <PickMany label={t.expertise} data={options(proficient, (id) => id, skillName)} max={expertise.count} value={s.skills.expertise}
          onChange={(v) => set('skills', { expertise: v })} describe="skill" />
      )}
      {otherTools.length > 0 && <Fixed label={t.toolsKnown} value={otherTools.map(([id, src]) => `${itemName(id)} (${src})`)} />}
      <div className={styles.grid2}>
        {cls.tool_proficiencies.fixed.length > 0 && <Fixed label={t.classTools} value={cls.tool_proficiencies.fixed.map(itemName)} />}
        {toolGroups.length > 0 && (
          <PickMany label={t.toolsToChoose} data={options(toolPool.filter((id) => !toolsKnown.has(id)), (id) => id, itemName)}
            max={toolGroups.reduce((n, g) => n + g.count, 0)} value={s.skills.classTools} onChange={(v) => set('skills', { classTools: v })} describe="item" />
        )}
      </div>
      <div className={styles.grid2}>
        <Fixed label={t.language} value={nameOf(byId.language.common)} description={t.commonHint} />
        <PickMany label={t.standardLanguages} max={2} value={s.skills.languages} onChange={(v) => set('skills', { languages: v })} describe="language"
          data={options(languages.filter((l) => l.rarity === 'standard' && !['common', ...classLangs].includes(l.id)), (l) => l.id, (l) => nameOf(l))} />
        {classLangs.length > 0 && <Fixed label={t.classLanguages} value={classLangs.map((id) => nameOf(byId.language[id]))} />}
        {extraLang && (
          <Pick label={t.extraLanguage} describe="language" value={s.skills.extraLanguages[0] ?? null}
            data={options(languages.filter((l) => !knownLangs.has(l.id) || s.skills.extraLanguages.includes(l.id)), (l) => l.id, (l) => nameOf(l))}
            onChange={(v) => set('skills', { extraLanguages: v ? [v] : [] })} />
        )}
      </div>
    </div>
  )
}

export function skillsValid(s: WizardState, d: Derived) {
  if (!d.cls) return false
  const { skillsKnown } = knownBeforeClass(d, s)
  const { count } = skillPool(d, new Set(skillsKnown.keys()))
  const toolsNeed = d.cls.tool_proficiencies.choose.reduce((n, g) => n + g.count, 0)
  const expertise = choiceOf(d, 'expertise')
  const extraLang = choiceOf(d, 'language')
  return (
    s.skills.classSkills.length === count &&
    s.skills.classTools.length === toolsNeed &&
    s.skills.languages.length === 2 &&
    (!expertise || s.skills.expertise.length === expertise.count) &&
    (!extraLang || s.skills.extraLanguages.length === extraLang.count)
  )
}

// ---------------------------------------------------------------- level 1 class choices

const FEATURE_TYPES = ['feat', 'class-option', 'weapon-mastery']

export function FeaturesStep({ s, d, set }: StepProps) {
  const t = useStrings().wizard.char
  const cls = d.cls!
  const f = s.features
  const choices = cls.level_1_choices.filter((c) => FEATURE_TYPES.includes(c.type))
  const withChoice = new Set(choices.map((c) => c.feature))
  const plain = cls.level_1_features.filter((x) => !withChoice.has(x.id))
  return (
    <div className={styles.stack}>
      {choices.length === 0 && <p className={styles.text}>{t.noLevel1Choices}</p>}
      {choices.map((c) => {
        if (c.type === 'feat') {
          return <Pick key={c.id} label={t.fightingStyle} data={options(fightingStyles, (x) => x.id, (x) => nameOf(x))} value={f.fightingStyle}
            onChange={(v) => set('features', { fightingStyle: v })} describe="feat" />
        }
        if (c.type === 'weapon-mastery') {
          const pool = weapons.filter((w) => w.mastery_classes.includes(cls.id))
          return (
            <PickMany key={c.id} label={t.weaponMastery} max={c.count} value={f.masteries} onChange={(v) => set('features', { masteries: v })} describe="item"
              data={options(pool, (w) => w.id, (w) => `${nameOf(w)} — ${ruName('weapon_masteries', w.mastery).toLowerCase()}`)} />
          )
        }
        if (c.options_group === 'eldritch-invocation') {
          const pool = (classOptions['eldritch-invocation'] || []).filter((o) => (o.min_level ?? 1) <= (c.max_prerequisite_level ?? 1))
          return (
            <PickMany key={c.id} label={t.invocations} data={options(pool, (o) => o.id, (o) => invocationName(o.id, nameOf(o)))} max={c.count}
              value={f.invocations} onChange={(v) => set('features', { invocations: v })}
              describe={(v) => ({ kind: 'class-option', id: 'eldritch-invocation/' + v })} />
          )
        }
        const group = c.options_group || ''
        return (
          <Pick key={c.id} label={group === 'divine-order' ? t.divineOrder : t.primalOrder} data={options(classOptions[group] || [], (o) => o.id, (o) => nameOf(o))}
            value={f.order} onChange={(v) => set('features', { order: v })} describe={(v) => ({ kind: 'class-option', id: group + '/' + v })} />
        )
      })}
      {plain.length > 0 && (
        <FeatureList label={t.otherLevel1} items={plain.map((x) => ({
          key: x.id, name: x.name_ru || x.name, text: classFeatures.find((cf) => cf.class === d.cls!.id && cf.feature === x.id)?.description_ru
        }))} />
      )}
    </div>
  )
}

export function featuresValid(s: WizardState, d: Derived) {
  if (!d.cls) return false
  const f = s.features
  return d.cls.level_1_choices
    .filter((c) => FEATURE_TYPES.includes(c.type))
    .every((c) => {
      if (c.type === 'feat') return Boolean(f.fightingStyle)
      if (c.type === 'weapon-mastery') return f.masteries.length === c.count
      if (c.options_group === 'eldritch-invocation') return f.invocations.length === c.count
      return Boolean(f.order)
    })
}
