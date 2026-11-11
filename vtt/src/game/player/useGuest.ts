// A player's tab in the master's game: it says hello, gets the map and the sheet, sends what the
// player does and takes what the others do. Without the master there is no game (QnA, «Можно ли
// играть без мастера?»): the tab waits and joins as soon as the master opens the game.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ExploredMask, MapStore, newId } from '../../map'
import { tabLink, type GameLink } from '../net/link'
import type { CampaignInfo, MapPayload, Roll } from '../net/protocol'
import type { Seat } from '../seat/seat'

/** How long to wait for the master's answer before telling the game has not started. */
const WAIT_MS = 800

/** The map of the game in this tab: a copy the master keeps up to date. */
export interface GuestMap {
  id: string
  store: MapStore
  explored?: ExploredMask
}

export type GuestState =
  | { status: 'connecting' | 'waiting' | 'ended' | 'gone' }
  | { status: 'joined'; campaign: CampaignInfo; seat: Seat | null; map: GuestMap | null }

export function useGuest(campaignId: string, playerId: string) {
  const [state, setState] = useState<GuestState>({ status: 'connecting' })
  const link = useRef<GameLink | null>(null)
  const tab = useMemo(() => newId(), [])

  useEffect(() => {
    const l = tabLink(campaignId)
    link.current = l
    let joined = false
    let current: GuestMap | null = null
    let unwatch: (() => void) | null = null
    // a map from the master: what this tab does on it goes to the master
    const open = (p: MapPayload | null): GuestMap | null => {
      unwatch?.()
      unwatch = null
      if (!p) return (current = null)
      const store = new MapStore(p.scene)
      const id = p.id
      unwatch = store.subscribe((_, op, source) => {
        if (source === 'local') l.send({ type: 'playerOp', tab, player: playerId, map: id, op })
      })
      return (current = { id, store, explored: p.scene.image ? new ExploredMask(p.scene.image, p.explored) : undefined })
    }
    const joinedWith = (patch: Partial<Extract<GuestState, { status: 'joined' }>>) =>
      setState((s) => (s.status === 'joined' ? { ...s, ...patch } : s))
    const hello = () => l.send({ type: 'hello', tab, player: playerId })

    const timer = setTimeout(() => setState((s) => (s.status === 'connecting' ? { status: 'waiting' } : s)), WAIT_MS)
    const off = l.listen((m) => {
      switch (m.type) {
        case 'host':
          hello()
          break
        case 'end':
          joined = false
          open(null)
          setState({ status: 'ended' })
          break
        case 'gone':
          if (m.player !== playerId) break
          joined = false
          open(null)
          setState({ status: 'gone' })
          break
        case 'welcome':
          if (m.to !== tab) break
          joined = true
          setState({ status: 'joined', campaign: m.state.campaign, seat: m.state.seat, map: open(m.state.map) })
          break
        case 'map':
          if (joined) joinedWith({ map: open(m.map) })
          break
        case 'resync':
          if (joined && m.to === tab) joinedWith({ map: open(m.map) })
          break
        case 'op':
          // the master's changes and the other players'; this tab's own it has already
          if (joined && current && m.map === current.id && m.from !== tab) current.store.dispatch(m.op, 'remote')
          break
        case 'seat':
          if (joined && m.player === playerId && m.from !== tab) joinedWith({ seat: m.seat })
          break
      }
    })
    hello()
    return () => {
      clearTimeout(timer)
      off()
      unwatch?.()
      l.close()
      link.current = null
    }
  }, [campaignId, playerId, tab])

  /** The player changed the sheet: here at once, then at the master's. */
  const changeSeat = useCallback((seat: Seat) => {
    setState((s) => (s.status === 'joined' ? { ...s, seat } : s))
    link.current?.send({ type: 'playerSeat', tab, player: playerId, seat })
  }, [tab, playerId])

  /** A roll goes into the master's log. */
  const roll = useCallback((r: Roll) => link.current?.send({ type: 'roll', tab, player: playerId, roll: r }), [tab, playerId])

  return { state, changeSeat, roll }
}
