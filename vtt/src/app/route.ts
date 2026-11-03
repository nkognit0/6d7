// Addresses of the screens, after «#»: the app is one page, the address keeps where the user is
// (reload, the back button, a player's game in its own tab).
import { useSyncExternalStore } from 'react'

export const EDITOR_TABS = ['maps', 'npc', 'players', 'settings'] as const
export type EditorTab = (typeof EDITOR_TABS)[number]

export type Route =
  | { page: 'home' }
  | { page: 'editor'; campaign: string; tab: EditorTab }
  | { page: 'play'; campaign: string }
  | { page: 'join'; code: string }
  // pages for development: the component preview, the map prototype, the sheet demo
  | { page: 'preview'; section?: string }
  | { page: 'map' }
  | { page: 'sheet' }

export function parseRoute(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').map(decodeURIComponent)
  const [head, a, b] = parts
  if (head === 'c' && a) {
    if (b === 'play') return { page: 'play', campaign: a }
    return { page: 'editor', campaign: a, tab: (EDITOR_TABS as readonly string[]).includes(b) ? (b as EditorTab) : 'maps' }
  }
  if (head === 'join' && a) return { page: 'join', code: a }
  if (head === 'preview') return a ? { page: 'preview', section: a } : { page: 'preview' }
  if (head === 'map') return { page: 'map' }
  if (head === 'sheet') return { page: 'sheet' }
  return { page: 'home' }
}

export function routeHash(r: Route): string {
  const e = encodeURIComponent
  switch (r.page) {
    case 'home':
      return '#/'
    case 'editor':
      return `#/c/${e(r.campaign)}/${r.tab}`
    case 'play':
      return `#/c/${e(r.campaign)}/play`
    case 'join':
      return `#/join/${e(r.code)}`
    case 'preview':
      return r.section ? `#preview/${e(r.section)}` : '#preview'
    case 'map':
      return '#map'
    case 'sheet':
      return '#sheet'
  }
}

/** Goes to a screen; `replace` — without a step back (a wrong address, a deleted campaign). */
export function go(r: Route, { replace = false } = {}) {
  const hash = routeHash(r)
  if (location.hash === hash) return
  if (replace) {
    history.replaceState(null, '', hash)
    dispatchEvent(new HashChangeEvent('hashchange'))
  } else location.hash = hash
}

/** The address of a screen for links and new tabs. */
export const routeUrl = (r: Route) => `${location.pathname}${location.search}${routeHash(r)}`

const subscribe = (fn: () => void) => {
  addEventListener('hashchange', fn)
  return () => removeEventListener('hashchange', fn)
}
const current = () => location.hash

/** The current screen; the component renders again when the address changes. */
export function useRoute(): Route {
  return parseRoute(useSyncExternalStore(subscribe, current, current))
}
