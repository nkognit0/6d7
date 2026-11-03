import { useEffect, useState, useSyncExternalStore } from 'react'
import { repo } from './local/LocalRepo'
import type { CampaignSession } from './session'

export type SessionState =
  | { status: 'loading' }
  | { status: 'missing' }
  | { status: 'failed'; error: unknown }
  | { status: 'open'; session: CampaignSession }

/**
 * Opens a campaign while the screen is shown and saves it when the screen goes. The component
 * renders again on every change of the campaign.
 */
export function useSession(campaignId: string): SessionState {
  const [state, setState] = useState<SessionState>({ status: 'loading' })
  useEffect(() => {
    let live = true
    let opened: CampaignSession | null = null
    setState({ status: 'loading' })
    repo.open(campaignId).then(
      (s) => {
        if (!live) return void s?.close()
        opened = s
        setState(s ? { status: 'open', session: s } : { status: 'missing' })
      },
      (error) => live && setState({ status: 'failed', error })
    )
    // the page may be closed at any moment: the documents are written whole when it hides
    const hide = () => document.visibilityState === 'hidden' && void opened?.save()
    document.addEventListener('visibilitychange', hide)
    return () => {
      live = false
      document.removeEventListener('visibilitychange', hide)
      void opened?.close()
    }
  }, [campaignId])
  const session = state.status === 'open' ? state.session : null
  useSyncExternalStore(session?.subscribe ?? noop, session?.getVersion ?? zero)
  return state
}

const noop = () => () => {}
const zero = () => 0
