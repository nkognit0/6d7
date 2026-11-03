// The description card of the inventories: a title, a subtitle, facts in two columns, the text and
// a note at the end (a spell always prepared).
import type { ReactNode } from 'react'
import styles from './Inventory.module.css'

export type Fact = [label: string, value: ReactNode, wide?: boolean]

export function Card(props: { icon?: string; title: string; subtitle?: string; facts: Fact[]; text?: string | null; textNote?: string; note?: string }) {
  return (
    <div className={styles.card}>
      <div className={styles.cardHead}>
        {props.icon && <img src={props.icon} alt="" />}
        <div>
          <div className={styles.cardTitle}>{props.title}</div>
          {props.subtitle && <div className={styles.cardSubtitle}>{props.subtitle}</div>}
        </div>
      </div>
      {props.facts.length > 0 && (
        <div className={styles.facts}>
          {props.facts.filter(([, v]) => v != null && v !== '').map(([label, value, wide]) => (
            <div key={label} className={`${styles.fact} ${wide ? styles.wide : ''}`}>
              <span className={styles.factLabel}>{label}</span>
              <span className={styles.factValue}>{value}</span>
            </div>
          ))}
        </div>
      )}
      {props.text && (
        <div className={styles.fact}>
          {props.textNote && <span className={styles.factLabel}>{props.textNote}</span>}
          <p className={styles.text}>{props.text}</p>
        </div>
      )}
      {props.note && <p className={styles.cardNote}>{props.note}</p>}
    </div>
  )
}
