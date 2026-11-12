// A phone: the windows show one pane at a time (QnA, «Окна инвентарей на телефоне»).
import { useSyncExternalStore } from 'react'

const QUERY = '(max-width: 767px)'

const subscribe = (fn: () => void) => {
  const m = matchMedia(QUERY)
  m.addEventListener('change', fn)
  return () => m.removeEventListener('change', fn)
}
const narrowNow = () => matchMedia(QUERY).matches

export function useNarrow(): boolean {
  return useSyncExternalStore(subscribe, narrowNow, narrowNow)
}
