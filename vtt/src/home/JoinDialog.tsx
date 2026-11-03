import { useEffect, useState } from 'react'
import { routeUrl } from '../app/route'
import { CODE_LENGTH, normalizeCode, repo } from '../campaign'
import { useStrings } from '../i18n'
import { Button, Modal, Overlay, TextInput } from '../ui'
import styles from './HomeScreen.module.css'

/**
 * «Присоединиться к игре»: the code the master sent. The game of the player opens in a new tab.
 * Without the server the code is looked up among the campaigns of this browser.
 */
export function JoinDialog({ onClose }: { onClose: () => void }) {
  const s = useStrings()
  const [code, setCode] = useState('')
  const [wrong, setWrong] = useState(false)
  const [busy, setBusy] = useState(false)
  const ready = normalizeCode(code).length === CODE_LENGTH

  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', key)
    return () => document.removeEventListener('keydown', key)
  }, [onClose])

  const join = async () => {
    if (!ready || busy) return
    setBusy(true)
    const target = await repo.findCode(normalizeCode(code)).catch(() => null)
    setBusy(false)
    if (!target) return setWrong(true)
    const url = routeUrl({ page: 'join', code: target.code })
    // a blocked new tab: the game opens here
    if (!window.open(url, '_blank')) location.href = url
    onClose()
  }

  return (
    <Overlay onClose={onClose} className={styles.dialogLayer}>
      <Modal title={s.home.joinTitle} onClose={onClose}>
        <form
          className={styles.join}
          onSubmit={(e) => {
            e.preventDefault()
            void join()
          }}
        >
          <TextInput
            autoFocus
            aria-label={s.home.joinCode}
            placeholder={s.home.joinCodeHint}
            value={code}
            status={wrong ? 'error' : undefined}
            maxLength={CODE_LENGTH + 2}
            autoComplete="off"
            spellCheck={false}
            className={styles.codeField}
            onChange={(e) => {
              setCode(e.target.value.toUpperCase())
              setWrong(false)
            }}
          />
          {wrong && <p className={styles.error}>{s.home.joinWrongCode}</p>}
          <Button type="submit" stretch disabled={!ready || busy}>{s.home.join}</Button>
        </form>
      </Modal>
    </Overlay>
  )
}
