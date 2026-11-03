// Steps of «Новый уровень». The choices, their options and texts come from the old app's plan.
import { byId, classes, classFeatures, nameOf, rules, subclasses } from '@app/data'
import {
  charLevel, classFeaturesAt, featChoices, featOptions, featStepKind, featureChoices, grantText, hpGain, nextLevel, speciesGainsAt,
  speciesLineageMissing, spellChoices, spellPlan, subclassFeaturesAt, subclassOf, type ChoiceDef, type LevelPicks
} from '@app/levelup/plan'
import { SPECIES_TRAIT_RU } from '@app/levelup/apply'
import { MAX_LEVEL, multiclassBlocker, type SheetInfo } from '@app/levelup/read'
import { rollDie } from '@app/rules/dice'
import { signed } from '@app/rules/derive'
import { ARMOR_RU } from '@app/wizard/steps/common'
import { useStrings, type Catalog } from '../../i18n'
import { Button, NavTab, RowTabs } from '../../ui'
import { skillOrTool, type Describe } from '../describe'
import { FeatureList, Fixed, Pick, PickMany } from '../fields'
import styles from '../Wizard.module.css'

export type StepId = 'class' | 'hp' | 'subclass' | 'feat' | 'features' | 'spells' | 'summary'

export interface LevelStepProps {
  info: SheetInfo
  picks: LevelPicks
  /** a change of the step's own value (hit points, subclass, feat) */
  update: (patch: Partial<LevelPicks>) => void
  /** a change of one listed choice */
  choose: (key: string, values: string[]) => void
}

const dndsuClass = (info: SheetInfo) => `https://next.dnd.su/class/${info.cls.id}/`

// what the panel describes for the options of a choice, by the kind of its key
function describeOf(def: ChoiceDef): Describe | undefined {
  if (def.describe) return def.describe
  const k = def.key
  if (k === 'ft:skill-or-tool') return skillOrTool
  if (k === 'ft:spell-list') return 'class'
  if (/^ft:(plus\d|ability)$|:save$/.test(k)) return 'ability'
  if (/:(skill|expertise|skill-or-expertise)$/.test(k)) return 'skill'
  if (/:(tool|weapons)$/.test(k)) return 'item'
  if (/:language$/.test(k)) return 'language'
  if (/:damage-type$/.test(k)) return 'damage-type'
  if (/:style$/.test(k)) return 'feat'
  if (/^sp:|:(spell|cantrip|spell-\d|mastery-\d|signature)$/.test(k)) return 'spell'
  return undefined
}

/** One choice: a single value is a list, several are chips; optional ones can be cleared. */
export function ChoiceField({ def, value, onChange }: { def: ChoiceDef; value: string[]; onChange: (v: string[]) => void }) {
  const t = useStrings().wizard.level
  if (!def.options.length) return <Fixed label={def.label} value={t.noOptions} description={def.description} />
  const describe = describeOf(def)
  if (def.count === 1) {
    return (
      <Pick label={def.label} description={def.description} data={def.options} value={value[0] ?? null}
        onChange={(v) => onChange(v ? [v] : [])} clearable={def.optional} describe={describe} />
    )
  }
  return <PickMany label={def.label} description={def.description} data={def.options} value={value} max={def.count} onChange={onChange} describe={describe} />
}

function ChoiceList({ defs, picks, choose }: { defs: ChoiceDef[]; picks: LevelPicks; choose: LevelStepProps['choose'] }) {
  const groups = [...new Set(defs.map((d) => d.source))]
  return (
    <div className={styles.stack}>
      {groups.map((g) => (
        <div key={g} className={styles.box}>
          <h4 className={styles.boxTitle}>{g}</h4>
          {defs.filter((d) => d.source === g).map((d) => (
            <ChoiceField key={d.key} def={d} value={picks.choices[d.key] || []} onChange={(v) => choose(d.key, v)} />
          ))}
        </div>
      ))}
    </div>
  )
}

const Link = ({ href, children }: { href: string; children: string }) => (
  <a className={styles.link} href={href} target="_blank" rel="noreferrer">{children}</a>
)

// ---------------------------------------------------------------- class (multiclassing)

/** What a new class gives when it is not the first one. */
export function multiclassGains(classId: string, t: Catalog['wizard']['level']): string[] {
  const p = rules.multiclass.proficiencies[classId] || {}
  const cls = classes.find((c) => c.id === classId)
  return [
    cls ? t.gainHitDie(cls.hit_die) : '',
    p.armor?.length ? t.gainArmor(p.armor.map((a: string) => ARMOR_RU[a].toLowerCase()).join(', ')) : '',
    p.weapons?.length ? t.gainMartial : '',
    p.skills ? (p.skills.from === 'class' ? t.gainClassSkill : t.gainAnySkill) : '',
    p.tools?.fixed?.length ? t.gainTools(p.tools.fixed.map((x: string) => nameOf(byId.item[x])).join(', ')) : '',
    p.tools?.count ? t.gainInstrument : '',
    t.gainLevel1
  ].filter(Boolean)
}

export function ClassStep({ info, picks, update }: LevelStepProps) {
  const t = useStrings().wizard.level
  const own = info.entries.map((e) => ({ value: e.cls.id, label: `${nameOf(e.cls)}: ${e.level} → ${e.level + 1}`, disabled: e.level >= MAX_LEVEL }))
  const others = classes.filter((c) => !info.entries.some((e) => e.cls.id === c.id)).map((c) => {
    const blocker = multiclassBlocker(info, c)
    return { value: c.id, label: `${nameOf(c)} 1`, hint: blocker ? t.needs(blocker) : t.newClassHint, disabled: Boolean(blocker) }
  })
  const target = picks.target ?? info.entries[0].cls.id
  return (
    <div className={styles.stack}>
      <p className={styles.text}>{t.classIntro(rules.multiclass.prerequisite.min_score)}</p>
      <Pick label={t.whichClass} data={[{ group: t.myClasses, items: own }, { group: t.newClass, items: others }]} value={target}
        onChange={(v) => update({ target: v === info.entries[0].cls.id ? null : v })} describe="class" />
      {info.newClass && (
        <div className={styles.box}>
          <h4 className={styles.boxTitle}>{t.newClassGives(nameOf(info.cls))}</h4>
          <ul className={styles.list}>{multiclassGains(info.cls.id, t).map((g) => <li key={g}>{g}</li>)}</ul>
          <p className={styles.muted}>{t.newClassNote}</p>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------- hit points

export function HpStep({ info, picks, update }: LevelStepProps) {
  const t = useStrings().wizard.level
  const hd = info.cls.hit_die
  const fixed = info.cls.hit_points.per_level.fixed
  const gain = hpGain(info, picks)
  return (
    <div className={styles.stack}>
      <p className={styles.text}>{t.hpIntro(hd)}{info.newClass ? ` ${t.hpNewClass}` : ''}</p>
      <RowTabs>
        <NavTab selected={picks.hp.method === 'fixed'} onClick={() => update({ hp: { method: 'fixed', roll: null } })}>{t.average(fixed)}</NavTab>
        <NavTab selected={picks.hp.method === 'roll'} onClick={() => update({ hp: { method: 'roll', roll: picks.hp.roll } })}>{t.rollDie(hd)}</NavTab>
      </RowTabs>
      {picks.hp.method === 'roll' && (
        <div className={styles.row}>
          <Button onClick={() => update({ hp: { method: 'roll', roll: rollDie(hd) } })}>{picks.hp.roll == null ? t.rollDie(hd) : t.rerollDie(hd)}</Button>
          {picks.hp.roll != null && <span className={styles.result}>{picks.hp.roll}</span>}
        </div>
      )}
      {gain && (
        <div className={styles.box}>
          <p className={styles.text}>
            {gain.base} {signed(gain.con)} ({t.constitution}){gain.extras.map((e) => ` ${signed(e.value)} (${e.label})`).join('')}
          </p>
          <p className={styles.text}><span className={styles.strong}>{t.hpGain(gain.total, info.maxHp, info.maxHp + gain.total)}</span></p>
          <p className={styles.muted}>{t.hpNote}</p>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------- subclass

export function SubclassStep({ info, picks, update }: LevelStepProps) {
  const t = useStrings().wizard.level
  const own = subclasses.filter((x) => x.class === info.cls.id)
  const sub = subclassOf(info, picks)
  return (
    <div className={styles.stack}>
      <Pick label={t.subclass} data={own.map((x) => ({ value: x.id, label: nameOf(x) }))} value={picks.subclass} onChange={(v) => update({ subclass: v })} describe="subclass" />
      {sub && (
        <div className={styles.box}>
          <h4 className={styles.boxTitle}>{t.subclassFeatures}</h4>
          <ul className={styles.list}>{sub.features.map((f) => <li key={f.id}>{t.featureAt(f.level, nameOf(f as never))}</li>)}</ul>
          <Link href={sub.link}>{t.subclassLink}</Link>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------- feat

export function FeatStep({ info, picks, update, choose }: LevelStepProps) {
  const t = useStrings().wizard.level
  const kind = featStepKind(info)!
  const f = picks.feat ? byId.feat[picks.feat] : null
  const defs = featChoices(info, picks)
  return (
    <div className={styles.stack}>
      <p className={styles.text}>{kind === 'epic-boon' ? t.epicIntro : t.featIntro} {t.featListNote}</p>
      <Pick label={kind === 'epic-boon' ? t.epicOrFeat : t.feat} data={featOptions(info, picks, kind)} value={picks.feat} onChange={(v) => update({ feat: v })} describe="feat" />
      {f?.link && <Link href={f.link}>{t.featLink}</Link>}
      {defs.length > 0 && <ChoiceList defs={defs} picks={picks} choose={choose} />}
    </div>
  )
}

// ---------------------------------------------------------------- features

export function FeaturesStep({ info, picks, choose }: LevelStepProps) {
  const t = useStrings().wizard.level
  const level = nextLevel(info)
  const sub = subclassOf(info, picks)
  const gained = classFeaturesAt(info, level).filter((f) => f.feature !== 'ability-score-improvement' && f.feature !== 'epic-boon')
  const subGained = subclassFeaturesAt(sub, level)
  const species = speciesGainsAt(info, charLevel(info))
  const defs = featureChoices(info, picks)
  const grants = grantText(info, picks)
  const unsupported = (info.cls.level_up_unsupported || []).filter((u) => u.level === level)
  const nothing = !gained.length && !subGained.length && !species.traits.length && !species.lineageSpells.length
  return (
    <div className={styles.stack}>
      {speciesLineageMissing(info) && <p className={styles.danger}>{t.lineageMissing(nameOf(info.species))}</p>}
      {nothing ? (
        <p className={styles.text}>{t.noNewFeatures}</p>
      ) : (
        <div className={styles.box}>
          <h4 className={styles.boxTitle}>{t.newFeatures}</h4>
          <FeatureList items={[
            ...gained.map((f) => ({ key: f.id, name: nameOf(f), text: f.description_ru })),
            ...subGained.map((f) => ({ key: f.id, name: nameOf(f as never), note: nameOf(sub), text: f.description_ru }))
          ]} />
          {species.traits.length + species.lineageSpells.length > 0 && (
            <ul className={styles.list}>
              {species.traits.map((x) => <li key={x.id}>{SPECIES_TRAIT_RU[x.id] || x.name} <span className={styles.muted}>({t.bySpecies})</span></li>)}
              {species.lineageSpells.map((id) => <li key={id}>{nameOf(byId.spell[id])} <span className={styles.muted}>({t.speciesSpell})</span></li>)}
            </ul>
          )}
          <Link href={sub?.link || dndsuClass(info)}>{t.featuresLink}</Link>
        </div>
      )}
      {grants.map((g) => <Fixed key={g.source + g.text} label={g.source} value={g.text} />)}
      {unsupported.map((u) => (
        <p key={u.feature} className={styles.alert}>{t.unsupported(nameOf(classFeatures.find((f) => f.class === info.cls.id && f.feature === u.feature)))}</p>
      ))}
      {defs.length > 0 && <ChoiceList defs={defs} picks={picks} choose={choose} />}
    </div>
  )
}

// ---------------------------------------------------------------- spells

export function SpellsStep({ info, picks, choose }: LevelStepProps) {
  const t = useStrings().wizard.level
  const plan = spellPlan(info, picks)
  const defs = spellChoices(info, picks)
  return (
    <div className={styles.stack}>
      {plan?.list && <p className={styles.text}>{t.spellCircles(plan.maxLevel)}{plan.cantripSwap || plan.preparedSwap ? ` ${t.swapOne}` : ''}</p>}
      {plan && plan.automatic.length > 0 && (
        <Fixed label={t.alwaysPrepared} value={plan.automatic.map((a) => nameOf(byId.spell[a.id]) + (a.tag ? ` (${a.tag})` : ''))} />
      )}
      {defs.length > 0 && <ChoiceList defs={defs} picks={picks} choose={choose} />}
    </div>
  )
}

// ---------------------------------------------------------------- summary

export function SummaryStep({ summary, warnings }: { summary: string[]; warnings: string[] }) {
  const t = useStrings().wizard.level
  return (
    <div className={styles.stack}>
      {warnings.map((w) => <p key={w} className={styles.alert}>{w}</p>)}
      <div className={styles.box}>
        <ul className={styles.list}>{summary.map((x) => <li key={x}>{x}</li>)}</ul>
      </div>
      <p className={styles.muted}>{t.summaryNote}</p>
    </div>
  )
}
