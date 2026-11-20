import { useEffect, useRef, useState } from 'react'
import { stateAttr } from '../../lib'
import styles from './InviteCode.module.css'

/** How long «Скопировано» stays above the code, ms. */
const COPIED_MS = 1500

/**
 * 6d7 / editor / players (14:1569): the invite code in link color. Under the pointer it is
 * underlined; a click copies it and a tooltip says so (QnA, 14.11.2026). States change at once,
 * without animation, like everywhere in 6d7.
 */
export function InviteCode({ code, title, copied, previewState }: {
  code: string
  /** the hint of the button: «Скопировать код» */
  title: string
  /** the tooltip after copying: «Скопировано» */
  copied: string
  /** the preview page pins a state */
  previewState?: 'hover' | 'copied'
}) {
  const [shown, setShown] = useState(false)
  const timer = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(timer.current), [])

  const copy = () => {
    void navigator.clipboard?.writeText(code).catch(() => {})
    setShown(true)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setShown(false), COPIED_MS)
  }

  return (
    <span className={styles.wrap}>
      <button type="button" className={styles.code} title={title} onClick={copy} {...stateAttr(previewState === 'hover' ? 'hover' : undefined)}>
        {code}
      </button>
      {(shown || previewState === 'copied') && <span role="status" className={styles.tooltip}>{copied}</span>}
    </span>
  )
}
