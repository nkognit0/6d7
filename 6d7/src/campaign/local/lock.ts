// A campaign is open in one tab of this browser at a time (Web Locks): two tabs writing the same
// documents whole would overwrite each other. Another tab can ask for it («Открыть здесь»): the
// tab that holds it writes what is not saved yet and lets it go. The server will keep the same
// rule for the master.

const name = (campaignId: string) => `6d7:campaign:${campaignId}`
const RELEASE = 'release'

export interface CampaignLock {
  /** Lets the campaign go (after its last write: the next tab reads what this one wrote). */
  release(): void
  /** Another tab asks for the campaign. */
  onAsked(fn: () => void): void
}

/**
 * Takes the campaign for this tab. `wait` — how long to wait for a tab that holds it (the screen
 * of this tab that is closing writes its last changes first); 0 — only if nobody holds it. Null —
 * another tab keeps it. Without Web Locks (an old browser, the dev server over http on the LAN)
 * tabs are not kept apart.
 */
export async function holdCampaign(campaignId: string, wait: number): Promise<CampaignLock | null> {
  let free!: () => void
  const held = new Promise<void>((resolve) => (free = resolve))
  const channel = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel(name(campaignId))
  let asked: (() => void) | null = null
  if (channel) channel.onmessage = (e: MessageEvent) => e.data === RELEASE && asked?.()
  let done = false
  const lock: CampaignLock = {
    release: () => {
      if (done) return
      done = true
      channel?.close()
      free()
    },
    onAsked: (fn) => {
      asked = fn
    }
  }
  const locks = typeof navigator === 'undefined' ? undefined : navigator.locks
  if (!locks) return lock
  const granted = await new Promise<boolean>((resolve) => {
    const stop = new AbortController()
    const timer = wait > 0 ? setTimeout(() => stop.abort(), wait) : null
    const options: LockOptions = wait > 0 ? { signal: stop.signal } : { ifAvailable: true }
    locks
      .request(name(campaignId), options, async (l) => {
        if (timer) clearTimeout(timer)
        resolve(!!l)
        if (l) await held
      })
      .catch(() => resolve(false))
  })
  if (granted) return lock
  lock.release()
  return null
}

/** Asks the tab that holds the campaign to let it go («Открыть здесь»). */
export function askForCampaign(campaignId: string) {
  if (typeof BroadcastChannel === 'undefined') return
  const channel = new BroadcastChannel(name(campaignId))
  channel.postMessage(RELEASE)
  channel.close()
}
