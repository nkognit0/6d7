// The character sheet of the VTT: the approved sheet (app/preview) in the dark theme — the sheet
// and the profile, every field editable — with the uses of features, exhaustion and the vision
// block, which the app counts and the player cannot edit. Equipment and spells live in the
// inventories.
import { resourcesOf, type Resource } from '@app/rules/uses'
import { visionOf } from '@app/rules/vision'
import { Checkbox } from '../../ui'
import { useStrings } from '../../i18n'
import { characterOf, type Seat } from '../seat/seat'
import { Abilities, Area, Big, Count, Field, Picture, Section, Skills, Stat, TextCard, str, type P } from './parts'
import styles from './Sheet.module.css'

function Header(props: P) {
  const s = useStrings()
  const f = (name: keyof typeof s.sheet.field) => <Field {...props} name={name} label={s.sheet.field[name]} />
  return (
    <div className={styles.head}>
      <Picture {...props} name="appearance" label={s.sheet.uploadPortrait} className={styles.portrait} />
      <div className={styles.fields}>
        <div className={styles.row}>{f('name')}</div>
        <div className={styles.row}>{f('species')}{f('size')}</div>
        <div className={styles.row}>{f('classLevel')}{f('subclass')}</div>
        <div className={styles.row}>{f('background')}{f('xp')}</div>
        <div className={styles.row}>{f('alignment')}</div>
        <div className={styles.row}>{f('age')}{f('height')}</div>
        <div className={styles.row}>{f('weight')}{f('playerName')}</div>
      </div>
    </div>
  )
}

/** Darkvision, the sight in darkness and in light: counted from the species, features and items in use. */
function Vision({ seat }: { seat: Seat }) {
  const s = useStrings()
  const v = visionOf(characterOf(seat))
  const feet = (n: number) => (n ? s.sheet.feet(n) : s.sheet.noSight)
  return (
    <Section title={s.sheet.vision}>
      <div className={`${styles.card} ${styles.vision}`} title={s.sheet.visionHint}>
        <div>
          <p className={styles.caption}>{s.sheet.darkvision}</p>
          <p className={styles.fixed}>{feet(v.darkvision)}</p>
          <p className={styles.hint}>{v.darkvisionFrom.join(', ') || ' '}</p>
        </div>
        <div>
          <p className={styles.caption}>{s.sheet.inDarkness}</p>
          <p className={styles.fixed}>{feet(v.darkness)}</p>
          <p className={styles.hint}>{v.darknessFrom ?? (v.darkness ? s.sheet.darkvision : s.sheet.noSightHint)}</p>
        </div>
        <div>
          <p className={styles.caption}>{s.sheet.inLight}</p>
          <p className={styles.fixed}>{s.sheet.unlimited}</p>
          <p className={styles.hint}>{s.sheet.unlimitedHint}</p>
        </div>
      </div>
    </Section>
  )
}

function Combat(props: P) {
  const s = useStrings()
  const inspired = !!str(props.c.inspiration).trim()
  return (
    <div className={styles.col}>
      <div className={`${styles.section} ${styles.grow}`}>
        <p className={styles.h}>{s.sheet.combat}</p>
        <div className={styles.stats}>
          <Stat {...props} name="ac" label={s.sheet.ac} />
          <Stat {...props} name="init" label={s.sheet.initiative} />
          <Stat {...props} name="speed" label={s.sheet.speed} />
        </div>
      </div>
      <div className={`${styles.section} ${styles.grow}`}>
        <p className={styles.h}>{s.sheet.hitPoints}</p>
        <div className={`${styles.card} ${styles.split}`}>
          <div><p className={styles.caption}>{s.sheet.current}</p><Big {...props} name="hp" label={s.sheet.currentHp} /></div>
          <div><p className={styles.caption}>{s.sheet.max}</p><Big {...props} name="maxHp" label={s.sheet.maxHp} /></div>
          <div><p className={styles.caption}>{s.sheet.temp}</p><Big {...props} name="tempHp" label={s.sheet.tempHp} /></div>
        </div>
      </div>
      <div className={`${styles.section} ${styles.grow}`}>
        <p className={styles.h}>{s.sheet.hitDice}</p>
        <div className={`${styles.card} ${styles.split}`}>
          <div><p className={styles.caption}>{s.sheet.current}</p><Big {...props} name="hitDice" label={s.sheet.hitDice} /></div>
          <div><p className={styles.caption}>{s.sheet.max}</p><Big {...props} name="hitDiceMax" label={s.sheet.hitDiceMax} /></div>
        </div>
      </div>
      <div className={`${styles.section} ${styles.grow}`} style={{ gap: 'var(--spacer-m)' }}>
        <p className={styles.h}>{s.sheet.deathSaves}</p>
        <div className={`${styles.card} ${styles.death}`}>
          <div className={styles.deathRow}><span className={styles.label}>{s.sheet.successes}</span><Count {...props} name="deathsaveSuccesses" max={3} label={s.sheet.successes} /></div>
          <div className={styles.deathRow}><span className={styles.label}>{s.sheet.failures}</span><Count {...props} name="deathsaveFailures" max={3} label={s.sheet.failures} /></div>
        </div>
      </div>
      <div className={`${styles.section} ${styles.grow}`}>
        <p className={styles.h}>{s.sheet.inspiration}</p>
        <div className={`${styles.card} ${styles.stat}`}>
          <Checkbox checked={inspired} aria-label={s.sheet.inspiration} onChange={(on) => props.set({ inspiration: on ? '✓' : '' })} />
        </div>
      </div>
      <div className={`${styles.section} ${styles.grow}`} style={{ gap: 'var(--spacer-m)' }}>
        <p className={styles.h}>{s.sheet.exhaustion}</p>
        <div className={`${styles.card} ${styles.death}`}>
          <div className={styles.deathRow}><span className={styles.label}>{s.sheet.exhaustionLevel}</span><Count {...props} name="exhaustion" max={6} label={s.sheet.exhaustion} /></div>
        </div>
      </div>
    </div>
  )
}

/** Features with limited uses: a box for each spent use; a big pool (Lay on Hands) as the uses left. */
function Uses(props: P) {
  const s = useStrings()
  const list: Resource[] = resourcesOf(props.c)
  if (!list.length) return null
  const spend = (id: string, used: number) => props.set({ resources: list.map((r) => (r.id === id ? { ...r, used } : r)) })
  return (
    <Section title={s.sheet.resources}>
      <div className={`${styles.card} ${styles.uses}`}>
        {list.map((r) => (
          <div key={r.id} className={styles.usesRow}>
            <span className={styles.label}>{r.name}</span>
            {r.max <= 10
              ? Array.from({ length: r.max }, (_, k) => k + 1).map((n) => (
                  <Checkbox key={n} checked={r.used >= n} aria-label={s.sheet.spent(r.name, n)} onChange={() => spend(r.id, r.used === n ? n - 1 : n)} />
                ))
              : (
                <>
                  <input className={`${styles.val} ${styles.usesLeft}`} inputMode="numeric" aria-label={s.sheet.usesLeft(r.name)} value={r.max - r.used}
                    onChange={(e) => spend(r.id, r.max - Math.max(0, Math.min(r.max, Number(e.target.value.replace(/\D/g, '')) || 0)))} />
                  <span className={styles.label}>{s.sheet.outOf(r.max)}</span>
                </>
              )}
          </div>
        ))}
      </div>
    </Section>
  )
}

export function CharacterSheet({ seat, onChange }: { seat: Seat; onChange: (seat: Seat) => void }) {
  const s = useStrings()
  const props: P = { c: seat.sheet, set: (patch) => onChange({ ...seat, sheet: { ...seat.sheet, ...patch } }) }
  const twice = (name: string, label: string, rows: number) => (
    <div className={styles.cols}>
      <div className={`${styles.card} ${styles.box} ${styles.col}`}><Area {...props} name={name} label={label} rows={rows} /></div>
      <div className={`${styles.card} ${styles.box} ${styles.col}`}><Area {...props} name={name + '2'} label={s.sheet.continued(label)} rows={rows} /></div>
    </div>
  )
  return (
    <>
      <section className={styles.page} id="sheet">
        <p className={styles.title}>{s.sheet.title}</p>
        <Header {...props} />
        <Abilities {...props} />
        <div className={styles.stats}>
          <Stat {...props} name="proficiencyBonus" label={s.sheet.proficiencyBonus} />
          <Stat {...props} name="passivePerception" label={s.sheet.passivePerception} />
        </div>
        <Vision seat={seat} />
        <div className={styles.cols}>
          <div className={`${styles.col} ${styles.section}`}>
            <p className={styles.h}>{s.sheet.skills}</p>
            <Skills {...props} />
          </div>
          <Combat {...props} />
        </div>
        <div className={styles.cols}>
          <TextCard {...props} name="languages" label={s.sheet.languages} rows={2} />
        </div>
        <Section title={s.sheet.classFeatures}>
          <div className={`${styles.card} ${styles.box}`}><Area {...props} name="classFeatures" label={s.sheet.classFeatures} rows={6} /></div>
        </Section>
        <Uses {...props} />
        <div className={styles.cols}>
          <TextCard {...props} name="speciesTraits" label={s.sheet.speciesTraits} rows={4} />
          <TextCard {...props} name="feats" label={s.sheet.feats} rows={4} />
        </div>
        <Section title={s.sheet.personality}>
          <div className={styles.grid2}>
            <TextCard {...props} name="personalityTraits" label={s.sheet.personalityTraits} inside />
            <TextCard {...props} name="ideals" label={s.sheet.ideals} inside />
            <TextCard {...props} name="bonds" label={s.sheet.bonds} inside />
            <TextCard {...props} name="flaws" label={s.sheet.flaws} inside />
          </div>
        </Section>
      </section>

      <section className={styles.page} id="profile">
        <p className={styles.title}>{s.sheet.profileTitle}</p>
        <div className={styles.row}>
          <Field {...props} name="eyes" label={s.sheet.field.eyes} />
          <Field {...props} name="skin" label={s.sheet.field.skin} />
          <Field {...props} name="hair" label={s.sheet.field.hair} />
        </div>
        <Section title={s.sheet.backstory}>
          <div className={`${styles.card} ${styles.box}`}><Area {...props} name="backstory" label={s.sheet.backstory} rows={6} /></div>
        </Section>
        <Section title={s.sheet.allies} gap>
          <div className={styles.org}>
            <div className={styles.fields}>
              <div className={styles.row}><Field {...props} name="factionRank" label={s.sheet.field.factionRank} /></div>
              <div className={styles.row}><Field {...props} name="faction" label={s.sheet.field.faction} /></div>
            </div>
            <Picture {...props} name="factionImg" label={s.sheet.field.emblem} className={styles.emblem} />
          </div>
          {twice('allies', s.sheet.allies, 4)}
        </Section>
        <Section title={s.sheet.additionalFeatures}>{twice('additionalFeatures', s.sheet.additionalFeatures, 4)}</Section>
        <div className={styles.cols}>
          <div className={`${styles.col} ${styles.section}`}>
            <p className={styles.h}>{s.sheet.attunement}</p>
            <div className={`${styles.card} ${styles.box} ${styles.grow}`}>
              {['attunedItem1', 'attunedItem2', 'attunedItem3'].map((name, i) => <Field key={name} {...props} name={name} label={`${i + 1}.`} plain />)}
            </div>
          </div>
          <div className={`${styles.col} ${styles.section}`}>
            <p className={styles.h}>{s.sheet.treasure}</p>
            <div className={`${styles.card} ${styles.box} ${styles.grow}`}>
              <Area {...props} name="treasure" label={s.sheet.treasure} rows={2} />
              <Area {...props} name="treasure2" label={s.sheet.continued(s.sheet.treasure)} rows={1} />
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
