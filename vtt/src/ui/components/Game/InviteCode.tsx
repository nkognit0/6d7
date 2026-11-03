import styles from './InviteCode.module.css'

/** D&D VTT / editor / players (14:1569): the invite code in link color; a click copies it. */
export function InviteCode({ code }: { code: string }) {
  return (
    <button type="button" className={styles.code} title="Скопировать код" onClick={() => void navigator.clipboard?.writeText(code)}>
      {code}
    </button>
  )
}
