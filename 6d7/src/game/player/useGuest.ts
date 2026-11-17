// A player's tab in the master's game: it says hello, gets the map and the sheet, sends what the
// player does and takes what the others do. Without the master there is no game (QnA, «Можно ли
// играть без мастера?»): the tab waits and joins as soon as the master opens the game.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ExploredMask, MapStore, newId, trackExplored, type RuleOverrides } from '../../map'
import { tabLink, type GameLink } from '../net/link'
import type { CampaignInfo, MapPayload, Roll } from '../net/protocol'
import { applySeatPatch, diffSeat } from '../seat/patch'
import type { Seat } from '../seat/seat'

/** How long to wait for the master's answer before telling the game has not started. */
const WAIT_MS = 800
/** The sheet goes to the master this long after the player stops typing… */
const SEND_MS = 300
/** …and at least this often while the player types on. */
const SEND_EVERY_MS = 1000

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
  // the sheet as the master has it and as it is here: what differs goes to the master in pauses
  const known = useRef<Seat | null>(null)
  const mine = useRef<Seat | null>(null)
  const sendTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingSince = useRef(0)
  const send = useRef<() => void>(() => {})

  useEffect(() => {
    const l = tabLink(campaignId)
    link.current = l
    let joined = false
    let current: GuestMap | null = null
    let unwatch: (() => void) | null = null
    let settings: RuleOverrides | undefined
    // a map from the master: what this tab does on it goes to the master; what players have seen
    // is explored here as at the master's, by the same operations (a tab in the background too)
    const open = (p: MapPayload | null): GuestMap | null => {
      unwatch?.()
      unwatch = null
      if (!p) return (current = null)
      const store = new MapStore(p.scene)
      const id = p.id
      const explored = p.scene.image ? new ExploredMask(p.scene.image, p.explored) : undefined
      const tracker = explored && trackExplored(store, explored, () => settings)
      const off = store.subscribe((_, op, source) => {
        if (source === 'local') l.send({ type: 'playerOp', tab, player: playerId, map: id, op })
      })
      unwatch = () => {
        off()
        tracker?.stop()
      }
      return (current = { id, store, explored })
    }
    const joinedWith = (patch: Partial<Extract<GuestState, { status: 'joined' }>>) =>
      setState((s) => (s.status === 'joined' ? { ...s, ...patch } : s))
    const hello = () => l.send({ type: 'hello', tab, player: playerId })
    send.current = () => {
      if (sendTimer.current) clearTimeout(sendTimer.current)
      sendTimer.current = null
      const now = mine.current
      const patch = joined && now ? diffSeat(known.current ?? undefined, now) : null
      if (!patch) return
      known.current = now
      l.send({ type: 'playerSeat', tab, player: playerId, patch })
    }

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
          settings = m.state.campaign.settings
          known.current = mine.current = m.state.seat
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
          // a change of the master's (a rest) or of another tab of this player; what this tab has not sent
          // yet stays, unless the change took the same fields
          if (!joined || m.player !== playerId || m.from === tab) break
          known.current = applySeatPatch(known.current ?? undefined, m.patch)
          mine.current = applySeatPatch(mine.current ?? undefined, m.patch)
          joinedWith({ seat: mine.current })
          break
      }
    })
    hello()
    // a tab being closed sends what it has not sent yet
    const leave = () => send.current()
    addEventListener('pagehide', leave)
    return () => {
      removeEventListener('pagehide', leave)
      send.current()
      clearTimeout(timer)
      off()
      unwatch?.()
      l.close()
      link.current = null
    }
  }, [campaignId, playerId, tab])

  /** The player changed the sheet: here at once, at the master's when the typing pauses. */
  const changeSeat = useCallback((seat: Seat) => {
    mine.current = seat
    setState((s) => (s.status === 'joined' ? { ...s, seat } : s))
    const now = Date.now()
    if (sendTimer.current) clearTimeout(sendTimer.current)
    else pendingSince.current = now
    const wait = Math.max(0, Math.min(SEND_MS, pendingSince.current + SEND_EVERY_MS - now))
    sendTimer.current = setTimeout(() => send.current(), wait)
  }, [])

  /** A roll goes into the master's log. */
  const roll = useCallback((r: Roll) => link.current?.send({ type: 'roll', tab, player: playerId, roll: r }), [tab, playerId])

  return { state, changeSeat, roll }
}
