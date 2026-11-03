import type { Change } from './types'

/** One step of «Отменить / Повторить»: the changes made and the changes that take them back. */
export interface HistoryStep {
  forward: Change[]
  backward: Change[]
}

/** Edits of the same thing within this time make one step (dragging a grid field, typing a name). */
export const MERGE_MS = 1000
const LIMIT = 200

/**
 * The history of the open editor (not saved: it lives while the campaign is open). Steps are
 * undone in order, last first, so the stored opposites stay valid.
 */
export class History {
  private done: HistoryStep[] = []
  private undone: HistoryStep[] = []
  private last: { key: string; at: number } | null = null

  /** `key` — what the step edits; a step with the same key soon after the last one joins it. */
  record(forward: Change[], backward: Change[], key: string | null = null, now = Date.now()) {
    if (!forward.length) return
    this.undone = []
    const top = this.done[this.done.length - 1]
    if (key && top && this.last?.key === key && now - this.last.at < MERGE_MS) {
      top.forward = [...top.forward, ...forward]
      top.backward = [...backward, ...top.backward]
    } else {
      this.done.push({ forward, backward })
      if (this.done.length > LIMIT) this.done.shift()
    }
    this.last = key ? { key, at: now } : null
  }

  get canUndo() {
    return this.done.length > 0
  }

  get canRedo() {
    return this.undone.length > 0
  }

  /** The step to take back; it moves to the redo list. */
  takeUndo(): HistoryStep | null {
    const step = this.done.pop() ?? null
    if (step) this.undone.push(step)
    this.last = null
    return step
  }

  takeRedo(): HistoryStep | null {
    const step = this.undone.pop() ?? null
    if (step) this.done.push(step)
    this.last = null
    return step
  }

  clear() {
    this.done = []
    this.undone = []
    this.last = null
  }
}
