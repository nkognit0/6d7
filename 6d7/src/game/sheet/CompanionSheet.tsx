// The companion sheet in the style of the character sheet: what a stat block has by the rules and
// the rules of the companion; every field is editable, the picture is uploaded by the player.
// At 0 Hit Points it tells how the rules bring the companion back and does it.
import { useState } from 'react'
import { companionDown, reviveCompanion, reviveOf, type CompanionSheet as Fields } from '@app/companion/companion'
import { Button } from '../../ui'
import { useStrings } from '../../i18n'
import { characterOf, withCharacter, type Seat } from '../seat/seat'
import { Abilities, Area, Big, Field, Picture, Stat, TextCard, type P } from './parts'
import styles from './Sheet.module.css'

function Fallen({ seat, onChange }: { seat: Seat; onChange: (seat: Seat) => void }) {
  const s = useStrings()
  const [error, setError] = useState<string | null>(null)
  const pet = seat.companion as Fields
  const r = reviveOf(pet)
  if (!companionDown(pet)) return null
  const revive = () => {
    const out = reviveCompanion(characterOf(seat))
    if ('error' in out) return setError(out.error)
    setError(null)
    onChange(withCharacter(seat, out.character))
  }
  return (
    <div className={`${styles.card} ${styles.fallen}`}>
      <p className={styles.fallenTitle}>{r?.kind === 'recast' ? s.companion.vanished : s.companion.fallen}</p>
      {r && <p className={styles.fallenText}>{r.rule_ru}</p>}
      {r && r.kind !== 'none' && <Button variant="primary" onClick={revive}>{s.companion.revive}</Button>}
      {error && <p className={styles.fallenText}>{error}</p>}
    </div>
  )
}

export function CompanionSheet({ seat, onChange }: { seat: Seat; onChange: (seat: Seat) => void }) {
  const s = useStrings()
  if (!seat.companion) return <section className={styles.page}><p className={styles.title}>{s.companion.title}</p><p className={styles.hint}>{s.companion.none}</p></section>
  const f = s.companion.field
  const p: P = { c: seat.companion, set: (patch) => onChange({ ...seat, companion: { ...seat.companion, ...(patch as Fields) } }) }
  const field = (name: string, label: string, plain?: boolean) => <Field {...p} name={name} label={label} plain={plain} />
  return (
    <section className={styles.page} id="companion">
      <p className={styles.title}>{s.companion.title}</p>
      <div className={styles.head}>
        <Picture {...p} name="portrait" label={s.companion.uploadPicture} className={styles.portrait} />
        <div className={styles.fields}>
          <div className={styles.row}>{field('name', f.name)}</div>
          <div className={styles.row}>{field('kindName', f.kind)}{field('form', f.form)}</div>
          <div className={styles.row}>{field('size', f.size)}{field('creatureType', f.type)}</div>
          <div className={styles.row}>{field('alignment', f.alignment)}{field('cr', f.cr)}</div>
          <div className={styles.row}>{field('initiativeRule', f.initiative, true)}</div>
        </div>
      </div>
      <Fallen seat={seat} onChange={onChange} />
      <Abilities {...p} />
      <div className={styles.stats}>
        <Stat {...p} name="ac" label={s.sheet.ac} />
        <Stat {...p} name="init" label={s.sheet.initiative} />
        <Stat {...p} name="proficiencyBonus" label={s.sheet.proficiencyBonus} />
        <Stat {...p} name="passivePerception" label={s.sheet.passivePerception} />
      </div>
      <div className={styles.cols}>
        <div className={`${styles.section} ${styles.grow}`}>
          <p className={styles.h}>{s.sheet.hitPoints}</p>
          <div className={`${styles.card} ${styles.split}`}>
            <div><p className={styles.caption}>{s.sheet.current}</p><Big {...p} name="hp" label={s.sheet.currentHp} /></div>
            <div><p className={styles.caption}>{s.sheet.max}</p><Big {...p} name="maxHp" label={s.sheet.maxHp} /></div>
            <div><p className={styles.caption}>{s.sheet.temp}</p><Big {...p} name="tempHp" label={s.sheet.tempHp} /></div>
          </div>
        </div>
        <div className={`${styles.section} ${styles.grow}`}>
          <p className={styles.h}>{s.companion.hitDiceSpeed}</p>
          <div className={`${styles.card} ${styles.split}`}>
            <div><p className={styles.caption}>{s.sheet.hitDice}</p><Big {...p} name="hitDice" label={s.sheet.hitDice} /></div>
            <div><p className={styles.caption}>{s.sheet.speed}</p><Area {...p} name="speed" label={s.sheet.speed} rows={1} /></div>
          </div>
        </div>
      </div>
      <div className={styles.cols}>
        <TextCard {...p} name="skillsText" label={s.companion.skills} rows={2} />
        <TextCard {...p} name="senses" label={s.companion.senses} rows={2} />
      </div>
      <div className={styles.cols}>
        <TextCard {...p} name="languages" label={s.sheet.languages} rows={2} />
        <TextCard {...p} name="defenses" label={s.companion.defenses} rows={2} />
      </div>
      <TextCard {...p} name="traits" label={s.companion.traits} rows={3} />
      <TextCard {...p} name="actions" label={s.companion.actions} rows={4} />
      <div className={styles.cols}>
        <TextCard {...p} name="bonusActions" label={s.companion.bonusActions} rows={3} />
        <TextCard {...p} name="reactions" label={s.companion.reactions} rows={3} />
      </div>
      <TextCard {...p} name="rules" label={s.companion.rules} rows={4} />
      <TextCard {...p} name="notes" label={s.companion.notes} rows={3} />
    </section>
  )
}
