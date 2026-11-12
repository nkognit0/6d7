// Parts of the sheets (character and companion): a field with an underline, a big number, ruled
// text, a stat card, the boxes of a count, a picture. Values are the free strings and flags of the
// sheet; a picture field keeps a reference to the media store (`media:<hash>`).
import { useRef, type ReactNode } from 'react'
import { ABILITIES, abilities, nameOf, skills } from '@app/data'
import { SKILL_FIELD } from '@app/rules/sheet'
import { Checkbox } from '../../ui'
import { useStrings } from '../../i18n'
import { storePicture, useMediaUrl } from '../media/media'
import type { MediaRef } from '../seat/seat'
import styles from './Sheet.module.css'

export type Fields = Record<string, unknown>
export interface P {
  c: Fields
  set: (patch: Fields) => void
}

export const str = (v: unknown) => (v == null ? '' : String(v))

// «СИЛ» of the rules; «Лов» after a skill
export const abilityAbbr = (id: string) => abilities.find((a) => a.id === id)?.abbr_ru || id.toUpperCase()
const abilityShort = (id: string) => { const a = abilityAbbr(id); return a[0] + a.slice(1).toLowerCase() }

function modifier(score: unknown): string {
  const s = str(score).trim()
  const n = Number(s)
  if (!s || isNaN(n)) return ''
  const m = Math.floor((n - 10) / 2)
  return m > 0 ? '+' + m : String(m)
}

/** A serif label and an underlined value. */
export function Field(props: P & { name: string; label: string; plain?: boolean }) {
  return (
    <label className={styles.field} data-field={props.name}>
      <span className={styles.label}>{props.label}</span>
      <input className={styles.val + (props.plain ? '' : ' ' + styles.upper)} value={str(props.c[props.name])}
        onChange={(e) => props.set({ [props.name]: e.target.value })} />
    </label>
  )
}

/** The big number of a stat card. */
export function Big(props: P & { name: string; label: string }) {
  return (
    <input className={styles.big} data-field={props.name} aria-label={props.label} placeholder="—"
      value={str(props.c[props.name])} onChange={(e) => props.set({ [props.name]: e.target.value })} />
  )
}

/** Free text on ruled lines; grows with its text and keeps at least `rows` lines to write on. */
export function Area(props: P & { name: string; label: string; rows?: number }) {
  const v = str(props.c[props.name])
  const rows = props.rows ?? 2
  return (
    <textarea className={styles.area} data-field={props.name} aria-label={props.label} rows={Math.max(rows, v.split('\n').length)}
      style={{ minHeight: rows * 28 }} value={v} onChange={(e) => props.set({ [props.name]: e.target.value })} />
  )
}

export function Stat(props: P & { name: string; label: string }) {
  return (
    <div className={`${styles.card} ${styles.stat}`}>
      <p className={styles.caption}>{props.label}</p>
      <Big {...props} />
    </div>
  )
}

/** Boxes of a count (death saves, exhaustion): the n-th box marks n; a click on the last one takes it back. */
export function Count(props: P & { name: string; max: number; label: string }) {
  const v = Number(props.c[props.name]) || 0
  return (
    <>
      {Array.from({ length: props.max }, (_, k) => k + 1).map((n) => (
        <Checkbox key={n} checked={v >= n} aria-label={`${props.label}: ${n}`} onChange={() => props.set({ [props.name]: v === n ? n - 1 : n })} />
      ))}
    </>
  )
}

export function TextCard(props: P & { name: string; label: string; rows?: number; inside?: boolean }) {
  return props.inside ? (
    <div className={`${styles.card} ${styles.box}`}>
      <span className={styles.label}>{props.label}</span>
      <Area {...props} />
    </div>
  ) : (
    <div className={`${styles.section} ${styles.col}`}>
      <p className={styles.h}>{props.label}</p>
      <div className={`${styles.card} ${styles.box} ${styles.grow}`}>
        <Area {...props} />
      </div>
    </div>
  )
}

export function Section(props: { title: string; children: ReactNode; gap?: boolean }) {
  return (
    <div className={styles.section} style={props.gap ? { gap: 'var(--spacer-m)' } : undefined}>
      <p className={styles.h}>{props.title}</p>
      {props.children}
    </div>
  )
}

const MAX_PICTURE = 25 * 1024 * 1024

/**
 * A picture of the sheet: a click picks a file; it is shrunk and kept in the media store, the
 * field keeps the reference. A sheet saved before keeps its picture as a data URL until replaced.
 */
export function Picture(props: P & { name: string; label: string; className: string }) {
  const s = useStrings()
  const input = useRef<HTMLInputElement>(null)
  const v = str(props.c[props.name])
  const stored = useMediaUrl(v.startsWith('media:') ? (v as MediaRef) : null)
  const src = v.startsWith('data:image/') ? v : stored
  const pick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (file.size > MAX_PICTURE) return window.alert(s.sheet.pictureTooLarge)
    try {
      props.set({ [props.name]: await storePicture(file) })
    } catch {
      window.alert(s.sheet.pictureUnreadable)
    }
  }
  return (
    <div className={`${styles.pic} ${props.className}`} data-field={props.name}>
      <button type="button" className={styles.picButton} onClick={() => input.current?.click()} title={v ? s.sheet.replacePicture : props.label}>
        {src ? <img src={src} alt={props.label} /> : <span>{props.label}</span>}
      </button>
      {v && (
        <button type="button" className={styles.picClear} onClick={() => props.set({ [props.name]: '' })} aria-label={s.sheet.removePicture} title={s.sheet.removePicture}>
          ×
        </button>
      )}
      <input ref={input} type="file" accept="image/*" hidden onChange={pick} />
    </div>
  )
}

/** Ability scores with their modifiers, and the saving throws. */
export function Abilities(props: P) {
  const s = useStrings()
  const { c, set } = props
  return (
    <div className={styles.card}>
      <div className={styles.strip}>
        {ABILITIES.map((k) => (
          <div key={k} data-field={k}>
            <p className={styles.caption}>{abilityAbbr(k)}</p>
            <p className={styles.mod}>{modifier(c[k]) || ' '}</p>
            <input className={styles.score} aria-label={abilityAbbr(k)} placeholder="—" value={str(c[k])} onChange={(e) => set({ [k]: e.target.value })} />
          </div>
        ))}
      </div>
      <div className={styles.stripHead}>{s.sheet.saves}</div>
      <div className={styles.strip}>
        {ABILITIES.map((k) => (
          <div key={k} className={styles.save} data-field={k + 'Save'}>
            <Checkbox checked={!!c[k + 'SaveChecked']} aria-label={s.sheet.saveProficiency(abilityAbbr(k))} onChange={(v) => set({ [k + 'SaveChecked']: v })} />
            <input className={styles.inline} aria-label={s.sheet.save(abilityAbbr(k))} placeholder="—" value={str(c[k + 'Save'])} onChange={(e) => set({ [k + 'Save']: e.target.value })} />
          </div>
        ))}
      </div>
    </div>
  )
}

/** The eighteen skills: proficiency, bonus, name and ability. */
export function Skills(props: P) {
  const s = useStrings()
  const { c, set } = props
  return (
    <div className={`${styles.card} ${styles.skills}`}>
      {Object.entries(SKILL_FIELD).map(([id, k]) => {
        const sk = skills.find((x) => x.id === id)
        const name = nameOf(sk)
        return (
          <div key={k} className={styles.skill} data-field={k}>
            <Checkbox checked={!!c[k + 'Checked']} aria-label={s.sheet.skillProficiency(name)} onChange={(v) => set({ [k + 'Checked']: v })} />
            <input className={styles.modIn} aria-label={name} placeholder="—" value={str(c[k])} onChange={(e) => set({ [k]: e.target.value })} />
            <span className={styles.skillName}>
              <span>{name}</span>
              <span className={styles.muted}>({sk ? abilityShort(sk.ability) : ''})</span>
            </span>
          </div>
        )
      })}
    </div>
  )
}
