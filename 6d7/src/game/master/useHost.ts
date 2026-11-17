// The master's tab holds the game for the players' tabs (as the server will): it greets a player
// with the map and the sheet, sends every change of the map of the game and of the sheets to all,
// takes the changes of the players after checking them and puts their rolls into the master's log.
import { useEffect, useRef } from 'react'
import { seatKey, type CampaignSession } from '../../campaign'
import type { Token } from '../../map'
import { allowPlayerOp } from '../net/allow'
import { tabLink } from '../net/link'
import type { CampaignInfo, GameMessage, MapPayload, Roll } from '../net/protocol'
import { companionToken, heroToken } from '../player/tokens'
import { applySeatPatch, diffSeat } from '../seat/patch'
import type { Seat } from '../seat/seat'
import type { ExploredKeeper } from './explored'

export interface HostEvents {
  /** a roll of a player, for the master's log */
  onRoll: (player: string, roll: Roll) => void
}

/**
 * `explored` — keeps the live mask of the map of the game; the saved one lags behind by a few
 * seconds.
 */
export function useHost(session: CampaignSession, explored: ExploredKeeper | null, events: HostEvents) {
  const latest = useRef(events)
  latest.current = events
  const keeper = useRef(explored)
  keeper.current = explored

  useEffect(() => {
    const link = tabLink(session.id)
    const info = (): CampaignInfo => {
      const c = session.campaign
      return { id: c.id, name: c.name, settings: c.settings, players: c.players }
    }
    const payload = (id: string | null): MapPayload | null => {
      const gm = id ? session.gameMap(id) : undefined
      if (!id || !gm) return null
      return { id, scene: gm.store.get(), explored: keeper.current?.of(id)?.save() ?? session.exploredOf(id) ?? null }
    }

    // the changes of the map of the game go to everyone; `from` — the tab whose change is applied now
    let active: string | null = null
    let from: string | null = null
    let unwatch: (() => void) | null = null
    const watch = (id: string | null) => {
      unwatch?.()
      unwatch = null
      active = id
      const gm = id ? session.gameMap(id) : undefined
      if (!id || !gm) return
      unwatch = gm.store.subscribe((_, op) => link.send({ type: 'op', map: id, op, from }))
    }
    watch(session.gameDoc?.active ?? null)

    // the sheets as the players' tabs know them: what changed since goes to them as a change of fields
    const sent = new Map<string, Seat | undefined>(session.campaign.players.map((p) => [p.id, session.seat(p.id)]))
    const offSession = session.subscribe(() => {
      const now = session.gameDoc?.active ?? null
      if (now !== active) {
        watch(now)
        link.send({ type: 'map', map: payload(now) })
      }
      for (const p of session.campaign.players) {
        const seat = session.seat(p.id)
        const was = sent.get(p.id)
        if (seat === was) continue
        sent.set(p.id, seat)
        const patch = seat && diffSeat(was, seat)
        if (patch) link.send({ type: 'seat', player: p.id, patch, from: null })
      }
    })

    const known = (player: string) => session.campaign.players.some((p) => p.id === player)
    const offLink = link.listen((m: GameMessage) => {
      switch (m.type) {
        case 'hello':
          if (!known(m.player)) link.send({ type: 'gone', player: m.player })
          else link.send({ type: 'welcome', to: m.tab, state: { campaign: info(), seat: session.seat(m.player) ?? null, map: payload(active) } })
          break
        case 'playerOp': {
          const store = active === m.map ? session.gameMap(m.map)?.store : undefined
          const slot = session.campaign.players.find((p) => p.id === m.player)
          if (!slot) break
          // the tokens of a player are the sheet's, not what the player's tab says they are
          const seat = session.seat(m.player)
          const ctx = {
            explored: keeper.current?.of(m.map),
            color: slot.color,
            expected: (t: Token) => (t.owner ? companionToken(slot, seat) : heroToken(slot, seat))
          }
          if (store && allowPlayerOp(store.get(), session.campaign.settings, m.player, m.op, ctx)) {
            from = m.tab
            try {
              store.dispatch(m.op)
            } finally {
              from = null
            }
          } else {
            const map = payload(active)
            if (map) link.send({ type: 'resync', to: m.tab, map })
            else link.send({ type: 'map', map: null })
          }
          break
        }
        case 'playerSeat':
          if (!known(m.player)) break
          // the player's tab has its change already: the others of this player take it as it is,
          // and only what else changes the sheet (a rest, the master) goes back as a change of its own
          sent.set(m.player, applySeatPatch(sent.get(m.player), m.patch))
          session.apply([{ doc: seatKey(m.player), op: m.patch }], { record: false })
          link.send({ type: 'seat', player: m.player, patch: m.patch, from: m.tab })
          break
        case 'roll':
          if (known(m.player)) latest.current.onRoll(m.player, m.roll)
          break
      }
    })

    // players already waiting join now; when the master leaves, the game is over for them
    link.send({ type: 'host' })
    const leave = () => link.send({ type: 'end' })
    addEventListener('pagehide', leave)
    return () => {
      removeEventListener('pagehide', leave)
      leave()
      offLink()
      offSession()
      unwatch?.()
      link.close()
    }
  }, [session])
}
