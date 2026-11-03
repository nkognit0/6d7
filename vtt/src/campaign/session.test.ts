import { describe, expect, it, vi } from 'vitest'
import { applyChange, createCampaign } from './campaign'
import { createScene } from '../map/core/scene'
import { CampaignSession, type DocWrite, type SessionStorage } from './session'
import type { CampaignDocs, CampaignMeta, Change } from './types'

// a storage that keeps what the session sends
function memoryStorage() {
  const journal: [number, Change][] = []
  const snapshots: { upto: number; writes: DocWrite[]; meta: CampaignMeta }[] = []
  const storage: SessionStorage = {
    append: async (_id, from, changes) => {
      changes.forEach((c, i) => journal.push([from + i, structuredClone(c)]))
    },
    compact: async (_id, upto, writes, meta) => {
      snapshots.push({ upto, writes, meta })
    }
  }
  return { storage, journal, snapshots }
}

function docs(): CampaignDocs {
  const map = { ...createScene('Таверна'), id: 'm1' }
  return { campaign: { ...createCampaign('Кампания', 'c1'), maps: ['m1'] }, maps: { m1: map }, seats: {} }
}

const tick = () => new Promise((r) => setTimeout(r, 0))

describe('CampaignSession', () => {
  it('undoes and redoes campaign and map changes', () => {
    const s = new CampaignSession(docs(), 0, memoryStorage().storage)
    const start = s.docs()
    s.apply([{ doc: 'campaign', op: { type: 'rename', name: 'Другое имя' } }])
    s.apply([
      { doc: 'map/m2', set: { ...createScene('Лес'), id: 'm2' } },
      { doc: 'campaign', op: { type: 'map.add', id: 'm2' } }
    ])
    // the map view changes its store directly, as the engine does
    s.map('m1')!.dispatch({ type: 'wall.add', wall: { id: 'w', kind: 'wall', a: { space: 'grid', u: 0, v: 0 }, b: { space: 'grid', u: 1, v: 0 } } })
    expect(s.docs().campaign.maps).toEqual(['m1', 'm2'])
    expect(s.map('m1')!.get().walls).toHaveLength(1)

    const end = s.docs()
    s.undo()
    expect(s.map('m1')!.get().walls).toHaveLength(0)
    s.undo()
    expect(s.map('m2')).toBeUndefined()
    s.undo()
    expect(s.docs()).toEqual(start)
    expect(s.history.canUndo).toBe(false)
    s.redo()
    s.redo()
    s.redo()
    expect(s.docs()).toEqual(end)
  })

  it('journals every change in order: replaying it gives the same documents', async () => {
    const { storage, journal } = memoryStorage()
    const initial = docs()
    const s = new CampaignSession(initial, 7, storage)
    s.apply([{ doc: 'campaign', op: { type: 'player.add', player: { id: 'p1', name: 'Арина', color: 'red' } } }])
    s.map('m1')!.dispatch({ type: 'grid', patch: { size: 3 } })
    s.apply([{ doc: 'seat/p1', set: { schema: 1, sheet: {}, spells: [], inventory: [], companion: null } }], { record: false })
    s.undo()
    await tick()
    expect(journal.map(([n]) => n)).toEqual([8, 9, 10, 11])
    const replayed = journal.reduce((d, [, ch]) => applyChange(d, ch), initial)
    expect(replayed).toEqual(s.docs())
    await s.close()
  })

  it('writes the changed documents after a pause', async () => {
    vi.useFakeTimers()
    const { storage, snapshots } = memoryStorage()
    const s = new CampaignSession(docs(), 0, storage)
    s.apply([{ doc: 'campaign', op: { type: 'rename', name: 'Новое' } }])
    await vi.advanceTimersByTimeAsync(3500)
    expect(snapshots).toHaveLength(1)
    expect(snapshots[0].writes.map(([k]) => k)).toEqual(['campaign'])
    expect(snapshots[0].meta.name).toBe('Новое')
    expect(s.saved).toBe(true)
    vi.useRealTimers()
  })

  it('makes a quick series of grid edits one step', () => {
    const s = new CampaignSession(docs(), 0, memoryStorage().storage)
    for (const size of [2.1, 2.2, 2.3]) s.map('m1')!.dispatch({ type: 'grid', patch: { size } })
    s.undo()
    expect(s.map('m1')!.get().grid.size).toBe(2)
    expect(s.history.canUndo).toBe(false)
  })
})
