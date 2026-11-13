import type { SessionState } from '../campaign'
import { useStrings } from '../i18n'
import { Button } from '../ui'
import styles from './ScreenMessage.module.css'

/** A message in place of a screen, an action under it and the way to the home screen. */
export function ScreenMessage({ text, action }: { text: string; action?: { label: string; run: () => void } }) {
  const s = useStrings()
  return (
    <div className={styles.screen}>
      <p>{text}</p>
      {action && <Button variant="primary" onClick={action.run}>{action.label}</Button>}
      <a href="#/">{s.stub.home}</a>
    </div>
  )
}

/** What a screen shows instead of a campaign it could not open (null — it is open or loading). */
export function SessionMessage({ state }: { state: SessionState }) {
  const s = useStrings()
  if (state.status === 'missing') return <ScreenMessage text={s.campaign.notFound} />
  if (state.status === 'failed') return <ScreenMessage text={s.campaign.storageFailed} />
  if (state.status === 'busy') return <ScreenMessage text={s.campaign.openElsewhere} action={{ label: s.campaign.openHere, run: state.takeOver }} />
  return null
}
