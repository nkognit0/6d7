import type { ReactNode } from 'react'
import styles from './preview.module.css'

/** One component on the preview page: name, Figma source, short description and its examples. */
export function Section({ id, title, figma, note, children }: { id: string; title: string; figma: string; note?: string; children: ReactNode }) {
  return (
    <section id={id} className={styles.section}>
      <header className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>{title}</h2>
        <span className={styles.figma}>{figma}</span>
      </header>
      {note && <p className={styles.note}>{note}</p>}
      <div className={styles.sectionBody}>{children}</div>
    </section>
  )
}

/** A row of examples with a label on the left. */
export function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={styles.row}>
      <span className={styles.rowLabel}>{label}</span>
      <div className={styles.rowItems}>{children}</div>
    </div>
  )
}

/** One example with a caption under it. */
export function Cell({ caption, children, width }: { caption: string; children: ReactNode; width?: number }) {
  return (
    <div className={styles.cell} style={width ? { width } : undefined}>
      <div className={styles.cellBody}>{children}</div>
      <span className={styles.caption}>{caption}</span>
    </div>
  )
}

/** The usual state columns of the UI Library. */
export const STATES = [
  { key: undefined, label: 'обычное' },
  { key: 'hover', label: 'наведение' },
  { key: 'active', label: 'нажатие' },
  { key: 'focus', label: 'фокус' }
] as const
