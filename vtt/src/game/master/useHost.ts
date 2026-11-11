// The master's tab holds the game for the players' tabs (as the server will): it greets a player
// with the map and the sheet, sends every change of the map of the game and of the sheets to all,
// takes the changes of the players after checking them and puts their rolls into the master's log.
import { useEffect, useRef } from 'react'
import { seatKey, type CampaignSession } from '../../campaign'
import type { ExploredMask } from '../../map'
import { allowPlayerOp } from '../net/allow'
import { tabLink } from '../net/link'
import type { CampaignInfo, GameMessage, MapPayload, Roll } from '../net/protocol'
import type { Seat } from '../seat/seat'

export interface HostEvents {
  /** a roll of a player, for the master's log */
  onRoll: (player: string, roll: Roll) => void
}

/**
 * `explored` — the live mask of the map of the game (what the master's map shows now); the saved
 * one lags behind by a few seconds.
 */
export function useHost(session: CampaignSession, explored: { current: ExploredMask | null }, events: HostEvents) {
  const latest = useRef(events)
  latest.current = events

  useEffect(() => {
    const link = tabLink(session.id)
    const info = (): CampaignInfo => {
      const c = session.campaign
      return { id: c.id, name: c.name, settings: c.settings, players: c.players }
    }
    const payload = (id: string | null): MapPayload | null => {
      const gm = id ? session.gameMap(id) : undefined
      if (!id || !gm) return null
      const mask = explored.current
      return { id, scene: gm.store.get(), explored: mask && mask.image === gm.store.get().image ? mask.save() : (session.exploredOf(id) ?? null) }
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

    // the sheets as sent last; whose tab changed a sheet (it has the change already)
    const sent = new Map<string, Seat | undefined>(session.campaign.players.map((p) => [p.id, session.seat(p.id)]))
    const seatFrom = new Map<string, string>()
    const offSession = session.subscribe(() => {
      const now = session.gameDoc?.active ?? null
      if (now !== active) {
        watch(now)
        link.send({ type: 'map', map: payload(now) })
      }
      for (const p of session.campaign.players) {
        const seat = session.seat(p.id)
        if (seat === sent.get(p.id)) continue
        sent.set(p.id, seat)
        if (seat) link.send({ type: 'seat', player: p.id, seat, from: seatFrom.get(p.id) ?? null })
        seatFrom.delete(p.id)
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
          if (!known(m.player)) break
          if (store && allowPlayerOp(store.get(), session.campaign.settings, m.player, m.op)) {
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
          seatFrom.set(m.player, m.tab)
          session.apply([{ doc: seatKey(m.player), set: m.seat }], { record: false })
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
  }, [session, explored])
}
