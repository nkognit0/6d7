// «Отменить / Повторить» of a screen of the game: the sheet, the companion sheet, an inventory.
// Every edit is saved at once, as before; the steps live only while the screen is open — leave it
// and they are gone. A step keeps the changed fields and their old values, not the whole seat:
// taking it back does not undo what someone else changed meanwhile (the master's rest for all).
import { useMemo, useRef } from 'react'
import { History } from '../../campaign'
import { useShortcuts } from '../../app/shortcuts'
import { applySeatPatch, diffSeat, invertSeatPatch, type SeatPatch } from '../seat/patch'
import type { Seat } from '../seat/seat'

// typing in one field soon after the last edit of it joins the same step
function mergeKey(p: SeatPatch): string | null {
  const fields = Object.keys(p.sheet ?? {})
  const parts = Object.keys(p).filter((k) => k !== 'sheet')
  return fields.length === 1 && !parts.length ? `sheet:${fields[0]}` : null
}

/**
 * The edits of the screen through `change` are recorded; Ctrl+Z / Ctrl+Shift+Z take them back and
 * redo them, in the text fields too. `screen` — a new value starts a new history (another window).
 * `enabled: false` — the keys are off (a wizard over the screen has its own).
 */
export function useSeatHistory(seat: Seat, onChange: (seat: Seat) => void, screen: string, enabled = true) {
  const current = useRef(seat)
  current.current = seat
  const history = useMemo(() => new History<SeatPatch>(), [screen])

  const change = (next: Seat) => {
    const before = current.current
    const p = diffSeat(before, next)
    if (!p) return
    history.record([p], [invertSeatPatch(before, p)], mergeKey(p))
    current.current = next
    onChange(next)
  }
  // the patches of a step one after another, on the seat as it is now
  const replay = (patches: SeatPatch[]) => {
    const next = patches.reduce((s, p) => applySeatPatch(s, p), current.current)
    current.current = next
    onChange(next)
  }
  const undo = () => {
    const step = history.takeUndo()
    if (step) replay(step.backward)
  }
  const redo = () => {
    const step = history.takeRedo()
    if (step) replay(step.forward)
  }
  useShortcuts('game', { undo, redo }, { inText: true, enabled })
  return change
}
