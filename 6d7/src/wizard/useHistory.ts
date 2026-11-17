// Undo / redo of a wizard as a React hook over the history of the rules package (without React).
import { useCallback, useState } from 'react'
import { fresh, record, stepBack, stepForward, type History } from '@rules/wizard/history'

export function useHistory<T>(init: () => T) {
  const [h, setH] = useState<History<T>>(() => fresh(init()))

  const change = useCallback((fn: (prev: T) => T, step: number, typing?: string) => {
    setH((cur) => record(cur, fn(cur.present), step, typing))
  }, [])

  // both return the step to show: the one where the undone / redone change was made
  const move = (r: [History<T>, number] | null): number | null => {
    if (!r) return null
    setH(r[0])
    return r[1]
  }

  const clear = useCallback((value: T) => setH(fresh(value)), [])

  return {
    value: h.present,
    change,
    undo: () => move(stepBack(h)),
    redo: () => move(stepForward(h)),
    clear,
    canUndo: h.past.length > 0,
    canRedo: h.future.length > 0
  }
}
