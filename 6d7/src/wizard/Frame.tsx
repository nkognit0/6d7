// The frame of every wizard (character, level, companion), like an installer: the steps are dots on
// top (a dot shows its step's name on hover), the step under them and the description of the chosen
// or hovered option on the right; the buttons at the bottom. Built from the inventory window.
import { useEffect, type ReactNode, type Ref } from 'react'
import { createPortal } from 'react-dom'
import { useStrings } from '../i18n'
import { Button, cx, GameWindow, Icon, IconButton, Overlay, RowTitle, WindowPane } from '../ui'
import { DescribeProvider, DescriptionPanel } from './describe'
import styles from './Wizard.module.css'

export interface FrameStep {
  title: string
  /** complete: its dot is filled */
  done: boolean
}

export function WizardFrame(props: {
  title: string
  onClose: () => void
  steps: FrameStep[]
  current: number
  /** the last step that can be opened (every step before it is complete) */
  maxStep: number
  onStep: (i: number) => void
  children: ReactNode
  footer: ReactNode
  /** the content of the step: the wizard scrolls its pane to the top on a new step */
  scrollRef?: Ref<HTMLDivElement>
}) {
  const s = useStrings()
  const step = props.steps[props.current]
  // Escape hides the wizard; its choices stay until it is opened again
  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === 'Escape' && props.onClose()
    document.addEventListener('keydown', key)
    return () => document.removeEventListener('keydown', key)
  })
  return createPortal(
    <Overlay className={styles.layer} onClose={props.onClose}>
      <DescribeProvider>
        <GameWindow className={styles.window}>
          <WindowPane
            header={
              <>
                <RowTitle title={props.title} action={<IconButton label={s.common.close} icon={<Icon name="close" />} onClick={props.onClose} />} />
                {props.steps.length > 1 && (
                  <nav className={styles.dots} aria-label={s.wizard.steps}>
                    {props.steps.map((st, i) => (
                      <button
                        key={st.title}
                        type="button"
                        className={cx(styles.dot, i === props.current ? styles.current : st.done && styles.done)}
                        disabled={i > props.maxStep}
                        title={st.title}
                        aria-label={st.title}
                        aria-current={i === props.current ? 'step' : undefined}
                        onClick={() => props.onStep(i)}
                      />
                    ))}
                  </nav>
                )}
              </>
            }
            footer={<div className={styles.footer}>{props.footer}</div>}
          >
            <div ref={props.scrollRef} className={styles.scroll}>
              <h3 className={styles.stepTitle}>{step?.title}</h3>
              {props.children}
            </div>
          </WindowPane>
          <WindowPane side width={300} className={styles.side} header={<RowTitle title={s.wizard.describeTitle} />}>
            <DescriptionPanel />
          </WindowPane>
        </GameWindow>
      </DescribeProvider>
    </Overlay>,
    document.body
  )
}

/** «Начать заново» on the left; «Отменить», «Повторить», «Назад» and the main button on the right. */
export function WizardFooter(props: {
  onReset?: () => void
  canUndo?: boolean
  canRedo?: boolean
  onUndo?: () => void
  onRedo?: () => void
  onBack?: () => void
  backDisabled?: boolean
  main: ReactNode
}) {
  const w = useStrings().wizard
  return (
    <>
      {props.onReset && <Button variant="secondary" onClick={props.onReset}>{w.startOver}</Button>}
      <span className={styles.footerEnd}>
        {props.onUndo && <Button variant="secondary" disabled={!props.canUndo} onClick={props.onUndo}>{w.undo}</Button>}
        {props.onRedo && <Button variant="secondary" disabled={!props.canRedo} onClick={props.onRedo}>{w.redo}</Button>}
        {props.onBack && <Button variant="primary" disabled={props.backDisabled} onClick={props.onBack}>{w.back}</Button>}
        {props.main}
      </span>
    </>
  )
}

/** The pane of the step scrolls to its top (every step opens at its top). */
export const scrollTop = (el: HTMLElement | null) => el?.parentElement?.scrollTo({ top: 0 })
