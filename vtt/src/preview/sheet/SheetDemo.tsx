// The sheet demo (#sheet): one player's sheets and inventories on the new seat model, for checking
// by hand. The seat starts from a demo character made by the old app's rules (its JSON goes
// through the importer, as an old sheet would) and is kept in this browser; pictures go to the
// media store.
import { useEffect, useMemo, useRef, useState } from 'react'
import type { DnDCharacter } from 'dnd-sheet'
import type { CompanionSheet as CompanionData } from '@app/companion/companion'
import { MAX_LEVEL, sheetLevel } from '@app/levelup/read'
import { longRest, shortRest } from '@app/rest/rest'
import { Button, GameMenuButton, Overlay, Plate, TopPanel, type PlayerIcon42Name } from '../../ui'
import { useStrings } from '../../i18n'
import { CharacterSheet } from '../../game/sheet/CharacterSheet'
import { CompanionSheet } from '../../game/sheet/CompanionSheet'
import { ItemsWindow } from '../../game/inventory/ItemsWindow'
import { SpellsWindow } from '../../game/inventory/SpellsWindow'
import { importCharacter } from '../../game/seat/import'
import { characterOf, withCharacter, type CompanionFields, type Seat } from '../../game/seat/seat'
import { CharacterWizard } from '../../wizard/character/CharacterWizard'
import { CompanionLevelUp, CompanionWizard } from '../../wizard/companion/CompanionWizard'
import { LevelUpWizard } from '../../wizard/levelup/LevelUpWizard'
import demo from './demo-character.json'
import styles from './SheetDemo.module.css'

const KEY = 'vtt-demo-seat'
type Page = 'sheet' | 'companion' | 'items' | 'spells'
const PAGES: [Page, PlayerIcon42Name][] = [['sheet', 'sheet.character'], ['companion', 'sheet.sidekick'], ['items', 'inventory'], ['spells', 'spells']]

function saved(): Seat | null {
  try {
    const raw = window.localStorage.getItem(KEY)
    const seat = raw ? (JSON.parse(raw) as Seat) : null
    return seat?.schema === 1 ? seat : null
  } catch {
    return null
  }
}

export function SheetDemo() {
  const s = useStrings()
  const [seat, setSeat] = useState<Seat | null>(saved)
  const [page, setPage] = useState<Page | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const file = useRef<HTMLInputElement>(null)
  // the wizards: a new sheet, its next level (again until a higher start is reached), the companion
  const [creating, setCreating] = useState(false)
  const [levelUp, setLevelUp] = useState(false)
  const [goal, setGoal] = useState<number | null>(null)
  const [companionWizard, setCompanionWizard] = useState<'new' | 'level' | null>(null)
  const character = useMemo(() => (seat ? characterOf(seat) : null), [seat])

  useEffect(() => {
    if (!seat) importCharacter(demo as DnDCharacter).then(setSeat)
  }, [seat])
  useEffect(() => {
    try {
      if (seat) window.localStorage.setItem(KEY, JSON.stringify(seat))
    } catch {
      // the demo works without storage
    }
  }, [seat])

  if (!seat || !character) return <div className={styles.screen} />
  const level = sheetLevel(character)
  const companion = seat.companion as CompanionData | null
  const newCompanion = () => (!companion || window.confirm(s.sheetDemo.replaceCompanion)) && setCompanionWizard('new')
  const change = (next: Seat) => setSeat(next)
  const rest = (kind: 'short' | 'long') => {
    const c = characterOf(seat)
    const r = kind === 'long' ? longRest(c) : shortRest(c, [])
    setMessage(r.changes.join(' · ') || s.sheetDemo.restNothing)
    setSeat(withCharacter(seat, r.character))
  }
  const reset = () => {
    if (!window.confirm(s.sheetDemo.resetConfirm)) return
    setMessage(null)
    importCharacter(demo as DnDCharacter).then(setSeat)
  }
  const pickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    try {
      setSeat(await importCharacter(JSON.parse(await f.text()) as DnDCharacter))
      setMessage(null)
    } catch {
      setMessage(s.sheetDemo.importFailed)
    }
  }
  const close = () => {
    setPage(null)
    setMessage(null)
  }
  const label: Record<Page, string> = { sheet: s.player.nav.sheet, companion: s.player.nav.companion, items: s.player.nav.inventory, spells: s.player.nav.spells }

  return (
    <div className={styles.screen}>
      <div className={styles.intro}>
        <a href="#preview">{s.sheetDemo.back}</a>
        <span>{s.sheetDemo.intro}</span>
        <div className={styles.wizards}>
          <Button onClick={() => setCreating(true)}>{s.sheet.createSheet}</Button>
          {level != null && level < MAX_LEVEL && <Button variant="primary" onClick={() => setLevelUp(true)}>{s.sheet.levelUp(level + 1)}</Button>}
          <Button variant="primary" onClick={newCompanion}>{s.companion.create}</Button>
          {companion && <Button variant="primary" onClick={() => setCompanionWizard('level')}>{s.sheetDemo.companionLevel}</Button>}
        </div>
      </div>
      <CharacterWizard
        opened={creating}
        onClose={() => setCreating(false)}
        onComplete={(c, startLevel) => {
          setCreating(false)
          setMessage(null)
          importCharacter(c).then((next) => {
            setSeat(next)
            if (startLevel > 1) {
              setGoal(startLevel)
              setLevelUp(true)
            }
          })
        }}
      />
      {levelUp && (
        <LevelUpWizard key={level ?? 0} character={character} goal={goal}
          onClose={() => {
            setLevelUp(false)
            setGoal(null)
          }}
          onComplete={(c) => {
            setSeat(withCharacter(seat, c))
            const more = goal != null && (sheetLevel(c) ?? MAX_LEVEL) < goal
            setLevelUp(more)
            if (!more) setGoal(null)
          }} />
      )}
      {companionWizard === 'new' && (
        <CompanionWizard character={character} onClose={() => setCompanionWizard(null)}
          onComplete={(sheet) => {
            setSeat({ ...seat, companion: sheet as CompanionFields })
            setCompanionWizard(null)
          }} />
      )}
      {companionWizard === 'level' && companion && (
        <CompanionLevelUp character={character} companion={companion} onClose={() => setCompanionWizard(null)}
          onComplete={(sheet) => {
            setSeat({ ...seat, companion: sheet as CompanionFields })
            setCompanionWizard(null)
          }} />
      )}
      <Plate edge="left" className={styles.plate}>
        {PAGES.map(([p, icon]) => (
          <GameMenuButton key={p} icon={icon} color="blue" label={label[p]} open={page === p} onClick={() => setPage(page === p ? null : p)} />
        ))}
      </Plate>
      {page && (
        <Overlay onClose={close}>
          <div className={styles.layer}>
            <TopPanel
              left={(
                <>
                  <Button variant="primary" onClick={() => rest('short')}>{s.rest.short}</Button>
                  <Button variant="primary" onClick={() => rest('long')}>{s.rest.long}</Button>
                </>
              )}
              right={(
                <>
                  <Button variant="primary" onClick={() => file.current?.click()}>{s.sheet.import}</Button>
                  <Button variant="primary" onClick={reset}>{s.sheetDemo.demoCharacter}</Button>
                  <input ref={file} className={styles.file} type="file" accept="application/json,.json" onChange={pickFile} />
                </>
              )} />
            {message && <div className={styles.message}>{message}</div>}
            {page === 'sheet' || page === 'companion' ? (
              <div className={styles.scroll} onClick={(e) => e.target === e.currentTarget && close()}>
                {page === 'sheet' ? <CharacterSheet seat={seat} onChange={change} /> : <CompanionSheet seat={seat} onChange={change} />}
              </div>
            ) : (
              <div className={styles.window} onClick={(e) => e.target === e.currentTarget && close()}>
                {page === 'items' ? <ItemsWindow seat={seat} onChange={change} /> : <SpellsWindow seat={seat} onChange={change} />}
              </div>
            )}
          </div>
        </Overlay>
      )}
    </div>
  )
}
