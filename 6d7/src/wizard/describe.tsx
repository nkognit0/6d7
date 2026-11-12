// The description panel of the wizards: the card of the option under the pointer (or the one just
// chosen) — class, background, species, feat, spell, item and so on. Fields report what they show
// through the context; the panel on the right of the wizard reads it.
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import abilitiesJson from '@data/abilities.json'
import damageTypesJson from '@data/damage-types.json'
import { abilityName, baseId, byId, classOptions, nameOf, ruName, skills, species, speciesOptions, subclasses, type Ability, type Named } from '@app/data'
import type { DescKind, DescRef } from '@app/wizard/describe'
import { creatureById, creatureTypeName, kindById, speedEntries } from '@app/companion/companion'
import { iconUrl } from '@app/inventory/inventory'
import { usesText } from '@app/rules/uses'
import { spellIconUrl } from '@app/spells/spells'
import { castingTime, count, duration, ITEM_CATEGORY_RU, MAGIC_TYPE_RU, range, RARITY_RU } from '@app/wiki/ru'
import { crText } from '@app/wildshape/wildshape'
import { ARMOR_RU, price } from '@app/wizard/steps/common'
import { Card, type Fact } from '../game/inventory/Card'
import { useStrings, type Catalog } from '../i18n'
import styles from './Wizard.module.css'

export type { DescKind, DescRef }
/** What a field describes: a kind for plain ids, or a function for composite values («skill:arcana»). */
export type Describe = DescKind | ((value: string) => DescRef | null)

export const refOf = (d: Describe | undefined, value: string | null | undefined): DescRef | null =>
  !d || !value ? null : typeof d === 'function' ? d(value) : { kind: d, id: value }

/** «skill:arcana» / «tool:lute» of the mixed skill-or-tool fields. */
export const skillOrTool: Describe = (v) =>
  v.startsWith('skill:') ? { kind: 'skill', id: v.slice(6) } : v.startsWith('tool:') ? { kind: 'item', id: v.slice(5) } : { kind: 'item', id: v }

const Ctx = createContext<{ shown: DescRef | null; show: (r: DescRef | null) => void }>({ shown: null, show: () => {} })

export function DescribeProvider({ children }: { children: ReactNode }) {
  const [shown, setShown] = useState<DescRef | null>(null)
  const show = useCallback((r: DescRef | null) => {
    if (r) setShown((prev) => (prev && prev.kind === r.kind && prev.id === r.id ? prev : r))
  }, [])
  const value = useMemo(() => ({ shown, show }), [shown, show])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export const useDescribe = () => useContext(Ctx)

// ---- cards

const list = (xs: string[]) => xs.join(', ') || '—'
const fact = (label: string, value: ReactNode, wide = false): Fact => [label, value, wide]

function sourceRu(src: string | undefined, d: Catalog['wizard']['describe']) {
  return src === 'phb-2024' ? d.phb : src === 'efota' ? d.efota : src === 'rthw' ? d.rthw : src === 'srd-5.2.1' ? undefined : src
}

// descriptions of the small lists the data module keeps no records of
const SMALL: Record<string, Named[]> = { abilities: abilitiesJson as Named[], 'damage-types': damageTypesJson as Named[] }
const smallText = (file: string, id: string) => SMALL[file]?.find((x) => x.id === id)?.description_ru

function itemCard(id: string, s: Catalog): ReactNode {
  const it = byId.item[id]
  if (!it) return null
  const m = it.magic
  const armor = byId.armor[baseId(id)]
  const ac = armor?.armor_class
  const acText = ac && (ac.bonus != null && ac.base == null ? `+${ac.bonus}` : `${ac.base ?? 10}${ac.add_dex ? s.inventory.plusDex(ac.dex_max ?? null) : ''}`)
  return (
    <Card icon={iconUrl(it.id)} title={nameOf(it)}
      subtitle={[it.name, m ? `${MAGIC_TYPE_RU[m.type] || m.type}, ${RARITY_RU[m.rarity] || m.rarity}` : ITEM_CATEGORY_RU[it.category]].filter(Boolean).join(' · ')}
      facts={[fact(s.inventory.price, price(it.cost)), fact(s.inventory.weight, it.weight_lb ? count(it.weight_lb, 'pound') : '—'), fact(s.inventory.armorClass, acText || null)]}
      text={it.description_ru || it.description} textNote={it.description_ru ? undefined : s.inventory.englishText} />
  )
}

function describeCard(r: DescRef, s: Catalog): ReactNode {
  const d = s.wizard.describe
  const yesNo = (v: boolean) => (v ? d.yes : d.no)
  switch (r.kind) {
    case 'class': {
      const c = byId.class[r.id]
      if (!c) return null
      return (
        <Card title={nameOf(c)} subtitle={c.name} text={c.description_ru} facts={[
          fact(d.hitDie, d.die(c.hit_die)),
          fact(d.primary, c.primary_abilities.map(abilityName).join(c.primary_ability_mode === 'any' ? d.or : d.and)),
          fact(d.saves, list(c.saving_throws.map(abilityName))),
          fact(d.armor, list(c.armor_training.map((a) => ARMOR_RU[a]))),
          fact(d.spells, c.spellcasting ? abilityName(c.spellcasting.ability) : d.no)
        ]} />
      )
    }
    case 'subclass': {
      const sub = subclasses.find((x) => x.id === r.id)
      if (!sub) return null
      return (
        <>
          <Card title={nameOf(sub)} subtitle={[sub.name, sourceRu(sub.source, d)].filter(Boolean).join(' · ')} text={sub.description_ru} facts={[]} />
          <div className={styles.describeMore}>
            {sub.features.map((f) => (
              <div key={f.id} className={styles.feature}>
                <span className={styles.text}>{f.name_ru || f.name} <span className={styles.muted}>{d.levelN(f.level)}</span></span>
                {f.description_ru && <span className={styles.muted}>{f.description_ru}</span>}
              </div>
            ))}
          </div>
        </>
      )
    }
    case 'background': {
      const b = byId.background[r.id]
      if (!b) return null
      return (
        <Card title={nameOf(b)} subtitle={b.name} text={b.description_ru} facts={[
          fact(d.abilities, list(b.ability_scores.map(abilityName))),
          fact(d.feat, nameOf(byId.feat[b.feat.id]) + (b.feat.spell_list ? ` (${ruName('classes', b.feat.spell_list)})` : '')),
          fact(d.skills, list(b.skill_proficiencies.map((id) => nameOf(byId.skill[id]))), true)
        ]} />
      )
    }
    case 'species': {
      const sp = species.find((x) => x.id === r.id)
      if (!sp) return null
      return (
        <Card title={nameOf(sp)} subtitle={[sp.name, sourceRu(sp.source, d)].filter(Boolean).join(' · ')} text={sp.description_ru} facts={[
          fact(d.speed, d.feet(sp.speed)),
          fact(d.darkvision, sp.darkvision ? d.feet(sp.darkvision) : d.no),
          fact(d.size, list(sp.size_options.map((o) => ruName('sizes', o.size)))),
          fact(d.resistances, list(sp.resistances.map((id) => ruName('damage_types', id))))
        ]} />
      )
    }
    case 'species-option': {
      const o = speciesOptions.find((x) => x.id === r.id)
      if (!o) return null
      return (
        <Card title={nameOf(o)} subtitle={o.name} text={o.description_ru} facts={[
          ...(o.resistances.length ? [fact(d.resistances, list(o.resistances.map((id) => ruName('damage_types', id))), true)] : []),
          ...(o.spells.length ? [fact(d.spells, list(o.spells.map((x) => `${nameOf(byId.spell[x.spell])} (${d.levelShort(x.character_level)})`)), true)] : [])
        ]} />
      )
    }
    case 'feat': {
      const f = byId.feat[r.id]
      if (!f) return null
      const p = f.prerequisite
      const req = [
        p?.minimum_level && d.levelN(p.minimum_level),
        p?.ability_any && `${p.ability_any.map(abilityName).join(d.or)} ${p.ability_min ?? 13}+`,
        p?.armor_training && d.armorTraining(ARMOR_RU[p.armor_training] || p.armor_training),
        p?.spellcasting && d.spellcasting,
        p?.feature_named && d.featureNamed(p.feature_named)
      ].filter(Boolean) as string[]
      const cat = d.featCategory[f.category as keyof typeof d.featCategory]
      return (
        <Card title={nameOf(f)} subtitle={[f.name, cat, sourceRu(f.source, d)].filter(Boolean).join(' · ')} text={f.description_ru}
          note={f.uses ? usesText(f.uses) : undefined}
          facts={[fact(d.requirements, list(req), true), fact(d.repeatable, yesNo(Boolean(f.repeatable)))]} />
      )
    }
    case 'class-option': {
      const [group, id] = r.id.split('/')
      const o = (classOptions[group] || []).find((x) => x.id === id)
      if (!o) return null
      return <Card title={nameOf(o)} subtitle={o.name} text={o.description_ru} note={o.uses ? usesText(o.uses) : undefined}
        facts={o.min_level ? [fact(d.level, d.fromLevel(o.min_level))] : []} />
    }
    case 'spell': {
      const sp = byId.spell[r.id]
      if (!sp) return null
      const c = sp.components
      return (
        <Card icon={spellIconUrl(sp.id)} title={nameOf(sp)}
          subtitle={`${sp.name} · ${sp.level === 0 ? d.cantrip : d.circle(sp.level)} · ${ruName('magic_schools', sp.school).toLowerCase()}`}
          text={sp.description_ru} facts={[
            fact(d.time, castingTime(sp.casting_time)),
            fact(d.range, range(sp.range)),
            fact(d.duration, duration(sp.duration)),
            fact(d.components, [c.verbal && d.verbal, c.somatic && d.somatic, c.material && d.material].filter(Boolean).join(', ') || '—'),
            fact(d.concentration, yesNo(Boolean(sp.concentration))),
            fact(d.ritual, yesNo(Boolean(sp.ritual)))
          ]} />
      )
    }
    case 'skill': {
      const sk = skills.find((x) => x.id === r.id)
      return sk ? <Card title={nameOf(sk)} subtitle={`${sk.name} · ${abilityName(sk.ability)}`} text={sk.description_ru} facts={[]} /> : null
    }
    case 'language': {
      const l = byId.language[r.id]
      return l ? <Card title={nameOf(l)} subtitle={`${l.name} · ${l.rarity === 'rare' ? d.rareLanguage : d.standardLanguage}`} text={l.description_ru} facts={[]} /> : null
    }
    case 'alignment': {
      const a = byId.alignment[r.id]
      return a ? <Card title={nameOf(a)} subtitle={a.name} text={a.description_ru} facts={[]} /> : null
    }
    case 'ability':
      return <Card title={abilityName(r.id as Ability)} text={smallText('abilities', r.id)} facts={[]} />
    case 'damage-type':
      return <Card title={ruName('damage_types', r.id)} text={smallText('damage-types', r.id)} facts={[]} />
    case 'size':
      return <Card title={ruName('sizes', r.id)} text={r.id === 'small' ? d.sizeSmall : r.id === 'medium' ? d.sizeMedium : undefined} facts={[]} />
    case 'companion': {
      const k = kindById[r.id]
      if (!k) return null
      return (
        <>
          <Card title={nameOf(k)} subtitle={k.name} text={k.rules_ru.slice(0, 2).join(' ')} facts={[]} />
          <div className={styles.describeMore}>
            <span className={styles.muted}>{d.whoCanHave}</span>
            <ul className={styles.list}>
              {k.access.map((a) => <li key={a.how_ru}>{a.how_ru}</li>)}
            </ul>
          </div>
        </>
      )
    }
    case 'creature': {
      const cr = creatureById[r.id]
      if (!cr) return null
      const speed = speedEntries(cr.speed).map(([k, v]) => `${d.speedKind[k as keyof typeof d.speedKind] ?? ''}${d.feet(v)}`).join(', ')
      return (
        <Card title={nameOf(cr)} subtitle={[cr.name, ruName('sizes', cr.size), cr.type ? creatureTypeName(cr.type).toLowerCase() : ''].filter(Boolean).join(' · ')}
          text={(cr.traits || []).map((t) => t.name_ru || t.name).join(', ') || undefined} facts={[
            ...(cr.challenge_rating != null && !cr.hit_points_formula ? [fact(d.challenge, crText(cr.challenge_rating))] : []),
            fact(d.ac, cr.armor_class_formula ? d.growsWithOwner : String(cr.armor_class ?? '—')),
            fact(d.hp, cr.hit_points_formula ? d.growWithOwner : String(cr.hit_points ?? '—')),
            fact(d.speed, speed, true),
            fact(d.darkvision, cr.senses?.darkvision ? d.feet(cr.senses.darkvision) : d.no),
            fact(d.actions, list((cr.actions || []).map((a) => a.name_ru || a.name)), true)
          ]} />
      )
    }
    case 'item':
      return itemCard(r.id, s)
  }
}

/** The panel on the right of a wizard. */
export function DescriptionPanel() {
  const s = useStrings()
  const { shown } = useDescribe()
  const card = shown ? describeCard(shown, s) : null
  return <div className={styles.describe}>{card ?? <p className={styles.describeEmpty}>{s.wizard.describeEmpty}</p>}</div>
}
