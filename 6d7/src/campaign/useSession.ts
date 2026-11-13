import { useEffect, useState, useSyncExternalStore } from 'react'
import { askForCampaign, holdCampaign } from './local/lock'
import { repo } from './local/LocalRepo'
import type { CampaignSession } from './session'

export type SessionState =
  | { status: 'loading' }
  | { status: 'missing' }
  | { status: 'failed'; error: unknown }
  /** open in another tab of this browser; `takeOver` asks it to let the campaign go and opens it here */
  | { status: 'busy'; takeOver: () => void }
  | { status: 'open'; session: CampaignSession }

/** How long a screen waits for the campaign: the screen of this tab that is closing writes its last changes first. */
const WAIT_MS = 1500
/** How long «Открыть здесь» waits for the other tab to write its changes and let go. */
const TAKE_MS = 10_000

/**
 * Opens a campaign while the screen is shown and saves it when the screen goes. The campaign is
 * open in one tab at a time: in another one the screen says so and can take it over. The
 * component renders again on every change of the campaign.
 */
export function useSession(campaignId: string): SessionState {
  const [state, setState] = useState<SessionState>({ status: 'loading' })
  // «Открыть здесь»: how many times this screen asked for the campaign
  const [asked, setAsked] = useState(0)
  useEffect(() => {
    let live = true
    let opened: CampaignSession | null = null
    let release: (() => void) | null = null
    const busy = () => setState({ status: 'busy', takeOver: () => setAsked((n) => n + 1) })
    // the last write first, then the campaign goes: the next tab reads what this one wrote
    const close = () => {
      const s = opened
      opened = null
      const done = release ?? (() => {})
      release = null
      void (s ? s.close() : Promise.resolve()).finally(done)
    }
    setState({ status: 'loading' })
    ;(async () => {
      if (asked) askForCampaign(campaignId)
      const lock = await holdCampaign(campaignId, asked ? TAKE_MS : WAIT_MS)
      if (!live) return lock?.release()
      if (!lock) return busy()
      release = lock.release
      // another tab took the campaign over: this one saves, lets go and says where it is now
      lock.onAsked(() => {
        if (!live) return
        live = false
        close()
        busy()
      })
      const s = await repo.open(campaignId)
      if (!live) {
        opened = s
        return close()
      }
      if (!s) {
        close()
        return setState({ status: 'missing' })
      }
      opened = s
      setState({ status: 'open', session: s })
    })().catch((error) => {
      if (!live) return
      close()
      setState({ status: 'failed', error })
    })
    // the page may be closed at any moment: the documents are written whole when it hides
    const hide = () => document.visibilityState === 'hidden' && void opened?.save()
    document.addEventListener('visibilitychange', hide)
    return () => {
      document.removeEventListener('visibilitychange', hide)
      if (!live) return
      live = false
      close()
    }
  }, [campaignId, asked])
  const session = state.status === 'open' ? state.session : null
  useSyncExternalStore(session?.subscribe ?? noop, session?.getVersion ?? zero)
  return state
}

const noop = () => () => {}
const zero = () => 0
