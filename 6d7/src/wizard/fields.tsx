// The fields of the wizards on the library: one value — a list with a search (Pick), several —
// chips and the same list (PickMany), a value that follows from earlier choices (Fixed). An option
// under the pointer or the arrows shows its description in the panel on the right (describe.tsx).
import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useStrings } from '../i18n'
import { matches } from '../npc/catalog'
import { cx, Icon, Menu, MenuItem, Textarea, TextInput } from '../ui'
import { refOf, useDescribe, type Describe } from './describe'
import styles from './fields.module.css'

/** hint: shown next to the option in the list, not in the chosen value */
export type Option = { value: string; label: string; hint?: string; disabled?: boolean }
export type OptionGroup = { group: string; items: Option[] }
export type Data = (Option | OptionGroup)[]

export const options = <T,>(list: T[], value: (x: T) => string, label: (x: T) => string): Option[] =>
  list.map((x) => ({ value: value(x), label: label(x) }))

type Flat = Option & { group?: string }
const flat = (data: Data): Flat[] => data.flatMap((x) => ('group' in x ? x.items.map((i) => ({ ...i, group: x.group })) : [x]))

/** A label over a control, with an optional description under the label. */
export function Field({ label, description, children, className }: { label?: ReactNode; description?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={cx(styles.field, className)}>
      {label && <span className={styles.label}>{label}</span>}
      {description && <span className={styles.description}>{description}</span>}
      {children}
    </div>
  )
}

/** The list of options under a field: in a layer of its own, so a scrolling step does not cut it. */
function Dropdown({ anchor, items, active, onActive, onPick }: {
  anchor: HTMLElement | null
  items: Flat[]
  active: number
  onActive: (i: number) => void
  onPick: (o: Flat) => void
}) {
  const s = useStrings()
  const [rect, setRect] = useState<DOMRect | null>(null)
  const list = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const place = () => setRect(anchor?.getBoundingClientRect() ?? null)
    place()
    addEventListener('scroll', place, true)
    addEventListener('resize', place)
    return () => {
      removeEventListener('scroll', place, true)
      removeEventListener('resize', place)
    }
  }, [anchor])
  // the highlighted option stays in sight while the arrows move it
  useEffect(() => {
    list.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [active])
  if (!rect) return null
  const below = innerHeight - rect.bottom
  const up = below < 200 && rect.top > below
  return createPortal(
    <div
      ref={list}
      className={styles.dropdown}
      style={{ left: rect.left, width: rect.width, ...(up ? { bottom: innerHeight - rect.top + 4 } : { top: rect.bottom + 4 }) }}
      onMouseDown={(e) => e.preventDefault()}
    >
      <Menu role="listbox" className={styles.menu}>
        {items.length === 0 && <span className={styles.nothing}>{s.common.nothingFound}</span>}
        {items.map((o, i) => (
          <div key={o.value} className={styles.option}>
            {o.group && o.group !== items[i - 1]?.group && <span className={styles.group}>{o.group}</span>}
            <MenuItem
              role="option"
              data-index={i}
              disabled={o.disabled}
              hint={o.hint}
              previewState={i === active ? 'hover' : undefined}
              onMouseEnter={() => onActive(i)}
              onClick={() => onPick(o)}
            >
              {o.label}
            </MenuItem>
          </div>
        ))}
      </Menu>
    </div>,
    document.body
  )
}

/** Keys of an open list: the arrows move the highlight (it is described), Enter picks, Escape closes. */
function useList(items: Flat[], onPick: (o: Flat) => void, describe?: Describe) {
  const { show } = useDescribe()
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const move = (i: number) => {
    setActive(i)
    show(refOf(describe, items[i]?.value))
  }
  const key = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      if (!open) return setOpen(true)
      const step = e.key === 'ArrowDown' ? 1 : -1
      let i = active
      for (let n = 0; n < items.length; n++) {
        i = (i + step + items.length) % items.length
        if (!items[i].disabled) break
      }
      move(i)
    } else if (e.key === 'Enter' && open) {
      e.preventDefault()
      const o = items[active]
      if (o && !o.disabled) onPick(o)
    } else if (e.key === 'Escape' && open) {
      e.stopPropagation()
      setOpen(false)
    }
  }
  return { open, setOpen, active, setActive: move, key }
}

export function Pick(props: {
  label: string
  data: Data
  value: string | null
  onChange: (v: string | null) => void
  description?: ReactNode
  placeholder?: string
  disabled?: boolean
  /** an optional choice can be cleared again */
  clearable?: boolean
  describe?: Describe
}) {
  const s = useStrings()
  const w = s.wizard
  const { show } = useDescribe()
  const [query, setQuery] = useState('')
  const frame = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const all = flat(props.data)
  const chosen = all.find((o) => o.value === props.value)
  const items = all.filter((o) => matches(query, [o.label, o.hint]))
  const pick = (o: Flat) => {
    props.onChange(o.value)
    show(refOf(props.describe, o.value))
    list.setOpen(false)
    setQuery('')
    input.current?.blur()
  }
  const list = useList(items, pick, props.describe)
  const disabled = props.disabled || all.length === 0
  return (
    <Field label={props.label} description={props.description}>
      <div ref={frame} className={styles.anchor}>
        <TextInput
          ref={input}
          disabled={disabled}
          value={list.open ? query : (chosen?.label ?? '')}
          placeholder={list.open && chosen ? chosen.label : (props.placeholder ?? (props.clearable ? w.notChosen : w.choose))}
          spellCheck={false}
          role="combobox"
          aria-expanded={list.open}
          aria-label={props.label || undefined}
          onFocus={() => {
            setQuery('')
            list.setOpen(true)
            list.setActive(Math.max(0, items.findIndex((o) => o.value === props.value)))
            show(refOf(props.describe, props.value))
          }}
          onBlur={() => list.setOpen(false)}
          onChange={(e) => {
            setQuery(e.target.value)
            list.setOpen(true)
            list.setActive(0)
          }}
          onKeyDown={list.key}
          trailing={
            props.clearable && props.value && !disabled ? (
              <button type="button" className={styles.clear} aria-label={w.clear} title={w.clear} onClick={() => props.onChange(null)}>
                <Icon name="close" />
              </button>
            ) : undefined
          }
        />
        {!(props.clearable && props.value && !disabled) && <span className={styles.chevron}><Icon name="chevron.down" /></span>}
      </div>
      {list.open && <Dropdown anchor={frame.current} items={items} active={list.active} onActive={list.setActive} onPick={pick} />}
    </Field>
  )
}

export function PickMany(props: {
  label: string
  data: Data
  value: string[]
  onChange: (v: string[]) => void
  max: number
  description?: ReactNode
  disabled?: boolean
  describe?: Describe
}) {
  const s = useStrings()
  const w = s.wizard
  const { show } = useDescribe()
  const [query, setQuery] = useState('')
  const frame = useRef<HTMLDivElement>(null)
  const all = flat(props.data)
  const left = props.max - props.value.length
  // the chosen ones are not offered again
  const items = all.filter((o) => !props.value.includes(o.value) && matches(query, [o.label, o.hint]))
  const pick = (o: Flat) => {
    const next = [...props.value, o.value]
    props.onChange(next)
    show(refOf(props.describe, o.value))
    setQuery('')
    if (next.length >= props.max) list.setOpen(false)
  }
  const list = useList(items, pick, props.describe)
  if (props.max === 1) {
    return (
      <Pick label={props.label} description={props.description} data={props.data} value={props.value[0] ?? null}
        onChange={(v) => props.onChange(v ? [v] : [])} disabled={props.disabled} describe={props.describe} />
    )
  }
  const label = (v: string) => all.find((o) => o.value === v)?.label ?? v
  const disabled = props.disabled || all.length === 0
  return (
    <Field label={props.label} description={props.description ?? (left > 0 ? w.chooseMore(left, props.max) : w.chosenAll(props.max))}>
      <div ref={frame} className={cx(styles.many, disabled && styles.disabled)} onClick={() => frame.current?.querySelector('input')?.focus()}>
        {props.value.map((v) => (
          <span key={v} className={styles.chip} onMouseEnter={() => show(refOf(props.describe, v))}>
            <span className={styles.chipText}>{label(v)}</span>
            {!disabled && (
              <button type="button" className={styles.chipRemove} aria-label={w.remove(label(v))} title={w.remove(label(v))}
                onClick={(e) => {
                  e.stopPropagation()
                  props.onChange(props.value.filter((x) => x !== v))
                }}>
                <Icon name="close" />
              </button>
            )}
          </span>
        ))}
        {left > 0 && !disabled && (
          <input
            className={styles.manyInput}
            value={query}
            placeholder={props.value.length ? '' : w.choose}
            spellCheck={false}
            role="combobox"
            aria-expanded={list.open}
            aria-label={props.label}
            onFocus={() => {
              list.setOpen(true)
              list.setActive(0)
            }}
            onBlur={() => {
              list.setOpen(false)
              setQuery('')
            }}
            onChange={(e) => {
              setQuery(e.target.value)
              list.setOpen(true)
              list.setActive(0)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Backspace' && !query && props.value.length) props.onChange(props.value.slice(0, -1))
              list.key(e)
            }}
          />
        )}
      </div>
      {list.open && left > 0 && <Dropdown anchor={frame.current} items={items} active={list.active} onActive={list.setActive} onPick={pick} />}
    </Field>
  )
}

/** A value that follows from earlier choices: shown, but not editable. */
export function Fixed(props: { label: string; value: string | string[]; description?: ReactNode }) {
  const values = (Array.isArray(props.value) ? props.value : [props.value]).filter(Boolean)
  return (
    <Field label={props.label} description={props.description}>
      <div className={styles.fixed}>
        {values.length > 1
          ? values.map((v) => <span key={v} className={styles.chip}><span className={styles.chipText}>{v}</span></span>)
          : <span className={styles.fixedText}>{values[0] || '—'}</span>}
      </div>
    </Field>
  )
}

/** Features gained without a choice, each with its short description. */
export function FeatureList(props: { label?: string; items: { key: string; name: string; note?: string; text?: string }[] }) {
  return (
    <div className={styles.features}>
      {props.label && <span className={styles.featuresLabel}>{props.label}</span>}
      {props.items.map((x) => (
        <div key={x.key} className={styles.featureItem}>
          <span className={styles.featureName}>
            {x.name}
            {x.note && <span className={styles.featureNote}> ({x.note})</span>}
          </span>
          {x.text && <span className={styles.featureText}>{x.text}</span>}
        </div>
      ))}
    </div>
  )
}

/** A text of the personality step; `typing` — undo takes back the whole edit of the field at once. */
export function TextField(props: { label: string; value: string; onChange: (v: string) => void; required?: boolean; placeholder?: string; autoFocus?: boolean }) {
  return (
    <Field label={props.required ? `${props.label} *` : props.label}>
      <TextInput value={props.value} placeholder={props.placeholder} autoFocus={props.autoFocus} aria-label={props.label} onChange={(e) => props.onChange(e.target.value)} />
    </Field>
  )
}

export function AreaField(props: { label: string; value: string; onChange: (v: string) => void; rows?: number }) {
  return (
    <Field label={props.label}>
      <Textarea value={props.value} rows={props.rows ?? 2} aria-label={props.label} className={styles.area} onChange={(e) => props.onChange(e.target.value)} />
    </Field>
  )
}
