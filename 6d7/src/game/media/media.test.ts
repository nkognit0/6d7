import { describe, expect, it } from 'vitest'
import { ORPHAN_MS, sweep } from './media'

describe('the media collector', () => {
  const at = 10 * ORPHAN_MS

  it('marks a file nothing refers to and deletes it only a day later', () => {
    expect(sweep(['a', 'b'], new Map(), new Set(['a']), at)).toEqual({ mark: ['b'], unmark: [], remove: [] })
    // still marked, not yet a day: nothing happens
    expect(sweep(['a', 'b'], new Map([['b', at - ORPHAN_MS + 1]]), new Set(['a']), at)).toEqual({ mark: [], unmark: [], remove: [] })
    expect(sweep(['a', 'b'], new Map([['b', at - ORPHAN_MS]]), new Set(['a']), at)).toEqual({ mark: [], unmark: [], remove: ['b'] })
  })

  it('lets a file referred to again keep living, and forgets marks without files', () => {
    expect(sweep(['a'], new Map([['a', 0], ['gone', 0]]), new Set(['a']), at)).toEqual({ mark: [], unmark: ['a', 'gone'], remove: [] })
  })

  it('deletes the files of a deleted campaign at once, unless another campaign has them', () => {
    expect(sweep(['own', 'shared'], new Map(), new Set(['shared']), at, new Set(['own', 'shared']))).toEqual({ mark: [], unmark: [], remove: ['own'] })
  })
})
