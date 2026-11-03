// Step 10: starting equipment options, choices inside them and purchases.
import { byId, categoryItems, equipment, nameOf } from '@app/data'
import type { EquipItemRef, EquipOption } from '@app/data'
import { bgEquipOption, classEquipOption, higherStart, purchasesCp, startMagicPool, startRarity, startingGoldCp } from '@app/rules/derive'
import type { Derived } from '@app/rules/derive'
import type { WizardState } from '@app/wizard/state'
import { moneyCp, price, type StepProps } from '@app/wizard/steps/common'
import { useStrings, type Catalog } from '../../i18n'
import { Button } from '../../ui'
import { Fixed, Pick, PickMany, options } from '../fields'
import styles from '../Wizard.module.css'

type T = Catalog['wizard']['char']
const catName = (id: string) => nameOf(byId.category[id])

function refLabel(ref: EquipItemRef, t: T): string {
  if (ref.item) return nameOf(byId.item[ref.item]) + (ref.qty > 1 ? ` ×${ref.qty}` : '')
  const cats = ref.categories || (ref.category ? [ref.category] : [])
  const what = cats.map(catName).join(t.or)
  return ref.same_as ? t.sameAsTool(what) : t.ofChoice(what)
}

function optionLabel(opt: EquipOption, t: T): string {
  const parts = (opt.items || []).map((r) => refLabel(r, t))
  if (opt.gp) parts.push(t.gp(opt.gp))
  return t.variant(opt.id, parts.join(', '))
}

const sameAsTool = (src: 'class' | 'bg', s: WizardState) => (src === 'class' ? s.skills.classTools[0] : s.background.toolChoice[0])

// positions of an option that need a choice («Musical Instrument of your choice», «Holy Symbol»)
const choicePositions = (opt: EquipOption | undefined) => (opt?.items || []).map((ref, i) => ({ ref, i })).filter(({ ref }) => !ref.item && !ref.same_as)

function OptionChoices({ src, opt, s, set }: { src: 'class' | 'bg'; opt: EquipOption | undefined; s: WizardState; set: StepProps['set'] }) {
  const t = useStrings().wizard.char
  if (!opt) return null
  return (
    <>
      {(opt.items || []).map((ref, i) => {
        const key = src + ':' + i
        if (ref.same_as) {
          const tool = sameAsTool(src, s)
          return <Fixed key={key} label={refLabel(ref, t)} value={tool ? nameOf(byId.item[tool]) : '—'} />
        }
        if (ref.item) return null
        const cats = ref.categories || (ref.category ? [ref.category] : [])
        const pool = cats.flatMap((c) => categoryItems(c))
        return (
          <Pick key={key} label={cats.map(catName).join(t.or)} data={options(pool, (x) => x.id, (x) => `${nameOf(x)} — ${price(x.cost)}`)}
            value={s.equipment.picks[key] ?? null} onChange={(v) => set('equipment', { picks: { ...s.equipment.picks, [key]: v } })} describe="item" />
        )
      })}
    </>
  )
}

const buyable = equipment.filter((x) => x.cost_cp != null && x.cost_cp > 0)
const RARITY_ORDER = ['common', 'uncommon', 'rare', 'very-rare', 'legendary'] as const
const d10 = Array.from({ length: 10 }, (_, i) => ({ value: String(i + 1), label: String(i + 1) }))

// a start above level 1: the d10 of the extra gold and up to so many magic items of each rarity
function HigherStartPicks({ s, set }: { s: WizardState; set: StepProps['set'] }) {
  const t = useStrings().wizard.char
  const hs = higherStart(s.cls.startLevel)
  if (!hs) return null
  const e = s.equipment
  return (
    <div className={styles.box}>
      <h4 className={styles.boxTitle}>{t.startAt(s.cls.startLevel)}</h4>
      {hs.rollGp > 0 && (
        <div className={styles.row}>
          <Pick label={t.extraGold(hs.fixedGp, hs.rollGp)} description={t.extraGoldHint} data={d10}
            value={e.goldRoll == null ? null : String(e.goldRoll)} onChange={(v) => set('equipment', { goldRoll: v ? Number(v) : null })} />
          <Button variant="primary" onClick={() => set('equipment', { goldRoll: 1 + Math.floor(Math.random() * 10) })}>{t.rollD10}</Button>
        </div>
      )}
      {RARITY_ORDER.filter((r) => hs.magic[r]).map((r) => {
        const mine = e.magic.filter((id) => startRarity(id) === r)
        return (
          <PickMany key={r} label={t.magicOf[r]} description={t.magicHint(hs.magic[r], mine.length)} max={hs.magic[r]} value={mine} describe="item"
            data={startMagicPool(r).map((x) => ({ value: x.id, label: nameOf(x) }))}
            onChange={(v) => set('equipment', { magic: [...e.magic.filter((id) => startRarity(id) !== r), ...v] })} />
        )
      })}
      <p className={styles.muted}>{t.magicNote}</p>
    </div>
  )
}

export function EquipmentStep({ s, d, set }: StepProps) {
  const t = useStrings().wizard.char
  const e = s.equipment
  const clsOpt = classEquipOption(d, s)
  const bgOpt = bgEquipOption(d, s)
  const gold = startingGoldCp(d, s)
  const spent = purchasesCp(s)
  const left = gold - spent
  return (
    <div className={styles.stack}>
      <Pick label={t.classEquipment(nameOf(d.cls))} data={(d.cls?.starting_equipment.options || []).map((o) => ({ value: o.id, label: optionLabel(o, t) }))}
        value={e.classOption} onChange={(v) => set('equipment', { classOption: v, picks: dropPicks(e.picks, 'class:') })} />
      <Pick label={t.bgEquipment(nameOf(d.bg))} data={(d.bg?.starting_equipment.options || []).map((o) => ({ value: o.id, label: optionLabel(o, t) }))}
        value={e.bgOption} onChange={(v) => set('equipment', { bgOption: v, picks: dropPicks(e.picks, 'bg:') })} />
      <div className={styles.grid2}>
        <OptionChoices src="class" opt={clsOpt} s={s} set={set} />
        <OptionChoices src="bg" opt={bgOpt} s={s} set={set} />
      </div>
      <HigherStartPicks s={s} set={set} />
      {e.classOption && e.bgOption && (
        <>
          <PickMany label={t.purchases} description={t.money(moneyCp(gold), moneyCp(spent), moneyCp(left))} max={99} value={e.purchases}
            data={buyable.map((x) => ({ value: x.id, label: `${nameOf(x)} — ${price(x.cost)}` }))} onChange={(v) => set('equipment', { purchases: v })} describe="item" />
          {left < 0 && <p className={styles.danger}>{t.notEnough(moneyCp(-left))}</p>}
          <p className={styles.muted}>{t.purchasesNote}</p>
        </>
      )}
    </div>
  )
}

const dropPicks = (picks: Record<string, string | null>, prefix: string) => Object.fromEntries(Object.entries(picks).filter(([k]) => !k.startsWith(prefix)))

export function equipmentValid(s: WizardState, d: Derived) {
  const e = s.equipment
  if (!e.classOption || !e.bgOption) return false
  const clsOpt = classEquipOption(d, s)
  const bgOpt = bgEquipOption(d, s)
  const picksDone = choicePositions(clsOpt).every(({ i }) => e.picks['class:' + i]) && choicePositions(bgOpt).every(({ i }) => e.picks['bg:' + i])
  const hs = higherStart(s.cls.startLevel)
  const startDone = !hs || (
    (hs.rollGp === 0 || e.goldRoll != null) &&
    e.magic.every((id) => { const r = startRarity(id); return r != null && e.magic.filter((x) => startRarity(x) === r).length <= (hs.magic[r] ?? 0) })
  )
  return picksDone && startDone && startingGoldCp(d, s) - purchasesCp(s) >= 0
}
