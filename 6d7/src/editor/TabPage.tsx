import type { ReactNode } from 'react'
import styles from './EditorScreen.module.css'

/** A page of the editor (14:1484, 41:4122): the title row with its action, the content under it. */
export function TabPage({ title, action, children }: { title: ReactNode; action?: ReactNode; children: ReactNode }) {
  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>{title}</h1>
        {action}
      </div>
      <div className={styles.pageBody}>{children}</div>
    </div>
  )
}
