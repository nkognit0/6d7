// The spell inventory (D&D VTT / game / spells 34:6975): the spells of the character, five in a
// row, with the filters «Все», «Заговоры», 1–9; the search over the spells of its lists with
// «Изучить»; the description with «Подготовить» and «Удалить» (the prepared ones within the limit
// of the sheet); the spell slots with their boxes, Pact Magic in a row of its own (no «Сбросить»:
// the boxes are cleared by hand).
import { useState } from 'react'
import { byId, nameOf, ruName, type SpellData } from '@app/data'
import { spellIconUrl } from '@app/spells/spells'
import { castingTime, duration, range } from '@app/wiki/ru'
import { Button, GameWindow, Icon, IconButton, InventorySlot, NavTab, SearchInput, SlotGrid, SpellSlotRow, WindowPane, slotMark } from '../../ui'
import { useStrings } from '../../i18n'
import {
  featurePrepared, forgetSpell, learnSpell, preparedCount, preparedMax, searchAvailable, setPactUsed, setSlotUsed, slotTotal, slotUsed, togglePrepared
} from '../seat/actions'
import { spellLevel, spellName, type Seat, type SpellEntry } from '../seat/seat'
import { Card, type Fact } from './Card'
import { BackHead } from './ItemsWindow'
import { useNarrow } from './narrow'
import styles from './Inventory.module.css'

// `always`: what keeps the spell prepared (a subclass, a species, a class feature), told at the end
function SpellCard({ entry, always }: { entry: SpellEntry; always: string | null }) {
  const s = useStrings()
  const sp: SpellData | undefined = byId.spell[entry.id]
  const level = (n: number) => (n === 0 ? s.spells.cantrip : s.spells.slotLevel(n))
  const note = always ? s.spells.alwaysPrepared(always) : undefined
  if (!sp) return <Card title={spellName(entry)} subtitle={`${s.spells.ownSpell} · ${level(spellLevel(entry))}`} facts={[]} note={note} />
  const c = sp.components
  const L = s.spells.componentLetters
  const comps = [c.verbal && L.verbal, c.somatic && L.somatic, c.material && L.material].filter(Boolean).join(', ')
  const facts: Fact[] = [
    [s.spells.level, level(sp.level)],
    [s.spells.school, ruName('magic_schools', sp.school)],
    [s.spells.castingTime, castingTime(sp.casting_time)],
    [s.spells.range, range(sp.range)],
    [s.spells.components, (comps || '—') + (c.material_text ? ` (${c.material_text})` : ''), true],
    [s.spells.duration, duration(sp.duration)],
    [s.spells.concentration, sp.concentration ? s.common.yes : s.common.no],
    [s.spells.ritual, sp.ritual ? s.common.yes : s.common.no]
  ]
  const text = sp.description_ru || [sp.description, sp.higher_level].filter(Boolean).join('\n\n')
  return <Card icon={spellIconUrl(sp.id)} title={nameOf(sp)} subtitle={sp.name} facts={facts} text={text}
    textNote={sp.description_ru ? undefined : s.spells.englishText} note={note} />
}

export function SpellsWindow({ seat, onChange }: { seat: Seat; onChange: (seat: Seat) => void }) {
  const s = useStrings()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<number | null>(null)
  const [chosen, setChosen] = useState<string | null>(null)
  // a phone shows one pane: the grid, the description of the tapped spell or the spell slots
  const narrow = useNarrow()
  const [view, setView] = useState<'grid' | 'detail' | 'slots'>('grid')
  const entry = seat.spells.find((e) => e.id === chosen) ?? null
  const show = (pane: 'grid' | 'detail' | 'slots') => !narrow || (pane === 'detail' ? view === 'detail' && !!entry : view === pane || (pane === 'grid' && view === 'detail' && !entry))
  const shown = seat.spells.filter((e) => filter == null || spellLevel(e) === filter)
  const results = query.trim() ? searchAvailable(seat, query) : []
  const count = preparedCount(seat)
  const max = preparedMax(seat)
  const levels = Array.from({ length: 9 }, (_, i) => i + 1).filter((l) => slotTotal(seat, l) > 0)
  const pact = Number(seat.sheet.pactSlotsTotal) || 0
  // always prepared: by a subclass or a species (tagged in the sheet) or by a class feature; such
  // spells have the frame of prepared ones too
  const byFeature = featurePrepared(seat)
  const always = entry ? entry.tag ?? byFeature.get(entry.id) ?? null : null
  const canPrepare = !!entry && spellLevel(entry) > 0 && !always
  return (
    <GameWindow>
      {show('grid') && <WindowPane
        header={(
          <>
            <div className={styles.head}>
              <span className={styles.headTitle}>{s.spells.title}</span>
              <div className={styles.search}><SearchInput placeholder={s.common.search} value={query} onChange={(e) => setQuery(e.target.value)} aria-label={s.spells.searchHint} /></div>
            </div>
            <div className={styles.tabs} role="tablist">
              <NavTab selected={filter == null} onClick={() => setFilter(null)}>{s.spells.filterAll}</NavTab>
              <NavTab selected={filter === 0} onClick={() => setFilter(0)}>{s.spells.filterCantrips}</NavTab>
              {Array.from({ length: 9 }, (_, i) => i + 1).map((l) => (
                <NavTab key={l} selected={filter === l} onClick={() => setFilter(l)}>{s.spells.filterLevel(l)}</NavTab>
              ))}
            </div>
          </>
        )}
        footer={max > 0 || narrow ? (
          <div className={styles.footerRow}>
            {max > 0 && <span className={styles.footerNote}>{s.spells.preparedLimit(count, max)}</span>}
            {narrow && <Button variant="secondary" onClick={() => setView('slots')}>{s.spells.slots}</Button>}
          </div>
        ) : undefined}>
        <div className={styles.body}>
          {query.trim() ? (
            <div className={styles.results}>
              {!results.length && <span className={styles.note}>{s.common.nothingFound}</span>}
              {results.map((sp) => (
                <div key={sp.id} className={styles.result}>
                  <img src={spellIconUrl(sp.id)} alt="" />
                  <div className={styles.resultName}><span>{nameOf(sp)}</span><span>{sp.level ? s.spells.slotLevel(sp.level) : s.spells.cantrip}</span></div>
                  <div className={styles.resultButtons}>
                    <Button variant="primary" onClick={() => { onChange(learnSpell(seat, sp.id)); setChosen(sp.id); setQuery('') }}>{s.spells.learn}</Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <SlotGrid>
              {shown.map((e) => (
                <InventorySlot key={e.id} label={spellName(e)} selected={e.id === chosen} onClick={() => {
                  setChosen(e.id)
                  setView('detail')
                }}
                  mark={slotMark({ equipped: !!e.prepared || !!e.tag || byFeature.has(e.id) })}>
                  {byId.spell[e.id] ? <img className={styles.slotPicture} src={spellIconUrl(e.id)} alt="" /> : <span className={styles.slotText}>{spellName(e)}</span>}
                </InventorySlot>
              ))}
            </SlotGrid>
          )}
        </div>
      </WindowPane>}
      {show('detail') && <WindowPane side width={narrow ? undefined : 300}
        header={narrow ? <BackHead title={s.spells.description} onBack={() => setView('grid')} /> : <span className={styles.headTitle}>{s.spells.description}</span>}
        footer={entry && (
          <div className={styles.buttons}>
            {canPrepare && (
              <Button stretch disabled={!entry.prepared && max > 0 && count >= max} title={!entry.prepared && max > 0 && count >= max ? s.spells.preparedFull : undefined}
                onClick={() => onChange(togglePrepared(seat, entry.id))}>
                {entry.prepared ? s.spells.unprepare : s.spells.prepare}
              </Button>
            )}
            <IconButton className={styles.remove} label={s.spells.remove} icon={<Icon name="minus" />} onClick={() => { onChange(forgetSpell(seat, entry.id)); setChosen(null) }} />
          </div>
        )}>
        {entry ? <SpellCard entry={entry} always={always} /> : <p className={styles.empty}>{s.spells.pick}</p>}
      </WindowPane>}
      {show('slots') && <WindowPane side width={narrow ? undefined : 220}
        header={narrow ? <BackHead title={s.spells.slots} onBack={() => setView('grid')} /> : <span className={styles.headTitle}>{s.spells.slots}</span>}>
        <div className={styles.slots}>
          {!levels.length && !pact && <span className={styles.note}>{s.spells.noSlots}</span>}
          {levels.map((l) => (
            <SpellSlotRow key={l} level={l} used={slotUsed(seat, l)} total={slotTotal(seat, l)} onChange={(n) => onChange(setSlotUsed(seat, l, n))} />
          ))}
          {pact > 0 && (
            <>
              <span className={styles.slotsCaption}>{s.spells.pactSlots}</span>
              <SpellSlotRow level={Number(seat.sheet.pactSlotLevel) || 1} used={Number(seat.sheet.pactSlotsUsed) || 0} total={pact}
                onChange={(n) => onChange(setPactUsed(seat, n))} />
            </>
          )}
        </div>
      </WindowPane>}
    </GameWindow>
  )
}
