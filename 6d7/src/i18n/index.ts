// The interface language: one setting switches every text. A language is a catalog of the same
// shape as ru.ts; to add one, write en.ts as `export const en: Catalog = { … }` and list it in
// LANGUAGES. Components read texts with useStrings() (or strings() outside React):
//   const s = useStrings(); <Button>{s.common.save}</Button>; s.sheet.levelUp(3)
import { useSyncExternalStore } from 'react'
import { ru } from './ru'

// the shape of a catalog: the same keys, any wording
type Shape<T> = { [K in keyof T]: T[K] extends string ? string : T[K] extends (...a: infer A) => string ? (...a: A) => string : Shape<T[K]> }
export type Catalog = Shape<typeof ru>

export const LANGUAGES: Record<string, { name: string; strings: Catalog }> = {
  ru: { name: 'Русский', strings: ru }
}
export type Language = keyof typeof LANGUAGES

const KEY = '6d7-language'
/** The key before the app was called 6d7: moved under the new one on the first start. */
const FORMER_KEY = 'vtt-language'
const DEFAULT: Language = 'ru'

function saved(): Language {
  try {
    const store = window.localStorage
    const former = store.getItem(FORMER_KEY)
    if (former !== null) {
      if (store.getItem(KEY) === null) store.setItem(KEY, former)
      store.removeItem(FORMER_KEY)
    }
    const v = store.getItem(KEY)
    if (v && v in LANGUAGES) return v
  } catch {
    // storage may be unavailable: the default language
  }
  return DEFAULT
}

let current: Language = saved()
const listeners = new Set<() => void>()

export const language = () => current
export const strings = (): Catalog => LANGUAGES[current].strings

export function setLanguage(l: Language) {
  if (!(l in LANGUAGES) || l === current) return
  current = l
  try {
    window.localStorage.setItem(KEY, l)
  } catch {
    // the choice lasts until the page is closed
  }
  listeners.forEach((f) => f())
}

const subscribe = (f: () => void) => {
  listeners.add(f)
  return () => listeners.delete(f)
}

// the texts of the current language; the component renders again when the language changes
export function useStrings(): Catalog {
  return useSyncExternalStore(subscribe, strings, strings)
}
