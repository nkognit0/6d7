// A window of a player's seat over the game (D&D VTT / game / player 30:4197, 45:3439, 31:4710,
// 34:6963): the top panel and the sheet, the companion sheet or an inventory under it, on the
// overlay. A click past the window closes it; a phone has no room past it, so there it gets «Закрыть».
// The master opens the same windows for a player.
import { useRef, useState } from 'react'
import { longRest, shortRest } from '@app/rest/rest'
import { useStrings } from '../../i18n'
import { Button, ConfirmDialog, Icon, IconButton, Menu, MenuDivider, MenuItem, Overlay, Popover, TopPanel } from '../../ui'
import { ItemsWindow } from '../inventory/ItemsWindow'
import { useNarrow } from '../inventory/narrow'
import { SpellsWindow } from '../inventory/SpellsWindow'
import { downloadCharacter } from '../seat/export'
import { importCharacter } from '../seat/import'
import { characterOf, withCharacter, type Seat } from '../seat/seat'
import { CharacterSheet } from '../sheet/CharacterSheet'
import { CompanionSheet } from '../sheet/CompanionSheet'
import type { useSeatWizards } from './useSeatWizards'
import styles from './Player.module.css'

export type SeatPage = 'sheet' | 'companion' | 'items' | 'spells'
type Wizards = ReturnType<typeof useSeatWizards>

/** «Отдых»: a short or a long rest of the hero, by the rules (hit points, dice, slots, resources). */
export function RestButton({ seat, onChange, onMessage }: { seat: Seat; onChange: (seat: Seat) => void; onMessage: (text: string) => void }) {
  const s = useStrings()
  const [open, setOpen] = useState(false)
  const rest = (kind: 'short' | 'long') => {
    setOpen(false)
    const c = characterOf(seat)
    const r = kind === 'long' ? longRest(c) : shortRest(c, [])
    onMessage(r.changes.join(' · ') || s.rest.nothingToRestore)
    onChange(withCharacter(seat, r.character))
  }
  return (
    <div className={styles.anchor}>
      <Button variant="primary" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)}>{s.sheet.rest}</Button>
      <Popover open={open} onClose={() => setOpen(false)}>
        <Menu>
          <MenuItem onClick={() => rest('short')}>{s.rest.short}</MenuItem>
          <MenuItem onClick={() => rest('long')}>{s.rest.long}</MenuItem>
        </Menu>
      </Popover>
    </div>
  )
}

/** Import, export and print of the sheet (the right cluster of the sheet panels). */
/** Import, export and print of the sheet: the file picker and the question before a named sheet is replaced. */
function useSheetFiles(seat: Seat, onChange: (seat: Seat) => void, onMessage: (text: string) => void) {
  const s = useStrings()
  const file = useRef<HTMLInputElement>(null)
  const [pending, setPending] = useState<Seat | null>(null)
  const pick = async (f: File) => {
    try {
      const next = { ...(await importCharacter(JSON.parse(await f.text()))), started: seat.started }
      if (seat.sheet.name) setPending(next)
      else onChange(next)
    } catch {
      onMessage(s.sheet.importFailed)
    }
  }
  return {
    upload: () => file.current?.click(),
    download: () => void downloadCharacter(seat, s.sheet.fileName),
    element: (
      <>
        <input ref={file} type="file" accept="application/json,.json" hidden onChange={(e) => {
          const f = e.target.files?.[0]
          e.target.value = ''
          if (f) void pick(f)
        }} />
        {pending && (
          <ConfirmDialog text={s.sheet.importReplace} confirm={s.sheet.replace} cancel={s.common.cancel}
            onConfirm={() => {
              onChange(pending)
              setPending(null)
            }}
            onCancel={() => setPending(null)} />
        )}
      </>
    )
  }
}

export function SheetFiles({ seat, onChange, onMessage }: { seat: Seat; onChange: (seat: Seat) => void; onMessage: (text: string) => void }) {
  const s = useStrings()
  const files = useSheetFiles(seat, onChange, onMessage)
  return (
    <>
      <IconButton label={s.sheet.import} icon={<Icon name="arrows.upload" />} onClick={files.upload} />
      <IconButton label={s.sheet.export} icon={<Icon name="arrows.download" />} onClick={files.download} />
      {/* the print template comes later (feature-requests) */}
      <IconButton label={s.sheet.printSoon} icon={<Icon name="media.text" />} disabled />
      {files.element}
    </>
  )
}

export type MoreItem = { label: string; run: () => void; disabled?: boolean }

/**
 * A phone: the top panel has no room for every button, so the rarer actions and (`files`) the sheet
 * files go to «Ещё».
 */
export function MoreMenu({ items, files, seat, onChange, onMessage }: {
  items: MoreItem[]
  files?: boolean
  seat: Seat
  onChange: (seat: Seat) => void
  onMessage: (text: string) => void
}) {
  const s = useStrings()
  const [open, setOpen] = useState(false)
  const sheetFiles = useSheetFiles(seat, onChange, onMessage)
  const item = ({ label, run, disabled }: MoreItem) => (
    <MenuItem key={label} disabled={disabled} onClick={() => {
      setOpen(false)
      run()
    }}>{label}</MenuItem>
  )
  return (
    <div className={styles.anchor}>
      <IconButton label={s.common.more} icon={<Icon name="more.three.dots" />} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)} />
      <Popover open={open} align="end" onClose={() => setOpen(false)}>
        <Menu>
          {items.map(item)}
          {files && items.length > 0 && <MenuDivider />}
          {files && [
            item({ label: s.sheet.import, run: sheetFiles.upload }),
            item({ label: s.sheet.export, run: sheetFiles.download }),
            item({ label: s.sheet.printSoon, run: () => {}, disabled: true })
          ]}
        </Menu>
      </Popover>
      {sheetFiles.element}
    </div>
  )
}

export function SeatWindow({ page, seat, onChange, wizards, onClose }: {
  page: SeatPage
  seat: Seat
  onChange: (seat: Seat) => void
  wizards: Wizards
  onClose: () => void
}) {
  const s = useStrings()
  const [message, setMessage] = useState<string | null>(null)
  const narrow = useNarrow()
  const levelUp = (
    <Button variant="primary" disabled={!wizards.canLevelUp} onClick={wizards.levelUp}>{s.sheet.levelUp((wizards.level ?? 0) + 1)}</Button>
  )
  const rest = <RestButton seat={seat} onChange={onChange} onMessage={setMessage} />
  const companionItems: MoreItem[] = [
    { label: s.companion.create, run: wizards.newCompanion },
    ...(wizards.companion ? [{ label: s.companion.levelUpCompanion, run: wizards.companionLevel }] : [])
  ]
  const left = page === 'companion' ? (
    narrow ? rest : (
      <>
        <Button onClick={wizards.newCompanion}>{s.companion.create}</Button>
        {wizards.companion && <Button variant="primary" onClick={wizards.companionLevel}>{s.companion.levelUpCompanion}</Button>}
        {rest}
      </>
    )
  ) : (
    <>
      {levelUp}
      {rest}
    </>
  )
  const sheet = page === 'sheet' || page === 'companion'
  // a click on the free space around the window closes it
  const outside = (e: React.MouseEvent) => e.target === e.currentTarget && onClose()
  return (
    <Overlay onClose={onClose}>
      <div className={styles.layer}>
        <TopPanel className={styles.top} left={left} right={(
          <>
            {sheet && !narrow && <SheetFiles seat={seat} onChange={onChange} onMessage={setMessage} />}
            {sheet && narrow && <MoreMenu items={page === 'companion' ? companionItems : []} files seat={seat} onChange={onChange} onMessage={setMessage} />}
            {narrow && <IconButton label={s.common.close} icon={<Icon name="close" />} onClick={onClose} />}
          </>
        )} />
        {message && <div className={styles.message} onClick={() => setMessage(null)}>{message}</div>}
        {sheet ? (
          <div className={styles.scroll} onClick={outside}>
            {page === 'sheet' ? <CharacterSheet seat={seat} onChange={onChange} /> : <CompanionSheet seat={seat} onChange={onChange} />}
          </div>
        ) : (
          <div className={styles.window} onClick={outside}>
            {page === 'items' ? <ItemsWindow seat={seat} onChange={onChange} /> : <SpellsWindow seat={seat} onChange={onChange} />}
          </div>
        )}
      </div>
    </Overlay>
  )
}
