// The wire of a game: tabs of one browser talk over a BroadcastChannel named after the campaign.
// The network will give the same three calls.
import type { GameMessage } from './protocol'

export interface GameLink {
  send(message: GameMessage): void
  listen(fn: (message: GameMessage) => void): () => void
  close(): void
}

export function tabLink(campaignId: string): GameLink {
  const channel = new BroadcastChannel(`6d7:game:${campaignId}`)
  const listeners = new Set<(message: GameMessage) => void>()
  channel.onmessage = (e: MessageEvent<GameMessage>) => {
    for (const fn of listeners) fn(e.data)
  }
  return {
    send: (message) => channel.postMessage(message),
    listen: (fn) => {
      listeners.add(fn)
      return () => {
        listeners.delete(fn)
      }
    },
    close: () => {
      listeners.clear()
      channel.close()
    }
  }
}
