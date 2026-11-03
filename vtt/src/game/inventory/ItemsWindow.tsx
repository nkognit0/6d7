// The item inventory (D&D VTT / game / inventory 33:6729): the cells, eight in a row; the search
// over every item of the rules with «Получить» and «Купить»; the coins; the description of the
// chosen thing with «Экипировать», «Маг. настройка» and «Удалить». No places on the hero: a
// thing in use is marked in its cell, and the sheet follows it (armour class, magic items).
import { useState } from 'react'
import { baseId, byId, nameOf, type EquipmentData } from '@app/data'
import { sheetWeaponRow } from '@app/inventory/gear'
import { COINS, iconUrl, searchItems, walletOf } from '@app/inventory/inventory'
import { attunementRequirement, effectsText } from '@app/inventory/magic'
import { ITEM_CATEGORY_RU, MAGIC_TYPE_RU, RARITY_RU, count, lightText } from '@app/wiki/ru'
import { price } from '@app/wizard/steps/common'
import { Button, CoinValue, GameWindow, Icon, IconButton, InventorySlot, SearchInput, SlotGrid, WindowPane, slotMark } from '../../ui'
import { useStrings } from '../../i18n'
import { addThing, attunable, attunedCount, attunementMax, buyThing, removeCell, setAttuned, setEquipped } from '../seat/actions'
import { characterOf, itemName, type ItemCell, type Seat } from '../seat/seat'
import { Card, type Fact } from './Card'
import styles from './Inventory.module.css'

// «14 + Лов (не больше 2)», «+2»
function armorText(it: EquipmentData, plusDex: (max: number | null) => string): string | null {
  const a = byId.armor[baseId(it.id)]
  if (!a) return null
  const ac = a.armor_class
  if (ac.bonus != null && ac.base == null) return `+${ac.bonus + (it.magic?.bonus ?? 0)}`
  const dex = ac.add_dex ? plusDex(ac.dex_max ?? null) : ''
  return `${(ac.base ?? 10) + (it.magic?.bonus ?? 0)}${dex}`
}

function ItemCard({ seat, cell }: { seat: Seat; cell: ItemCell }) {
  const s = useStrings()
  const it = cell.item ? byId.item[cell.item] : undefined
  if (!it) return <Card title={itemName(cell)} subtitle={s.inventory.ownThing} facts={[]} />
  const weapon = byId.weapon[baseId(it.id)] ? sheetWeaponRow(characterOf(seat), it.id) : null
  const m = it.magic
  const facts: Fact[] = [
    [s.inventory.price, price(it.cost)],
    [s.inventory.weight, it.weight_lb ? count(it.weight_lb, 'pound') : '—'],
    [s.inventory.attack, weapon ? [weapon.bonus, weapon.damage].filter(Boolean).join(', ') : null, true],
    [s.inventory.armorClass, armorText(it, s.inventory.plusDex)],
    [s.inventory.light, it.light ? lightText(it.light) : null, true],
    [s.inventory.effects, m ? effectsText(m.effects).join('; ') : null, true],
    [s.inventory.attunementNeeded, it.requires_attunement ? attunementRequirement(it) ?? s.common.yes : null, true]
  ]
  return (
    <Card icon={iconUrl(it.id)} title={nameOf(it)} facts={facts}
      subtitle={[it.name, m ? `${MAGIC_TYPE_RU[m.type] || m.type}, ${RARITY_RU[m.rarity] || m.rarity}` : ITEM_CATEGORY_RU[it.category]].filter(Boolean).join(' · ')}
      text={it.description_ru || it.description} textNote={it.description_ru ? undefined : s.inventory.englishText} />
  )
}

export function ItemsWindow({ seat, onChange }: { seat: Seat; onChange: (seat: Seat) => void }) {
  const s = useStrings()
  const [query, setQuery] = useState('')
  const [chosen, setChosen] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const cell = seat.inventory.find((c) => c?.uid === chosen) ?? null
  const wallet = walletOf(seat.sheet)
  const results = query.trim() ? searchItems(query) : []
  const get = (id: string) => {
    const next = addThing(seat, id)
    setMessage(next ? null : s.inventory.full)
    if (next) onChange(next)
  }
  const buy = (id: string) => {
    const next = buyThing(seat, id)
    if (typeof next === 'string') return setMessage({ price: s.inventory.noPrice, money: s.inventory.notEnoughMoney, full: s.inventory.full }[next])
    setMessage(null)
    onChange(next)
  }
  const attuned = attunedCount(seat)
  const max = attunementMax(seat)
  const full = !!cell && !cell.attuned && attuned >= max
  return (
    <GameWindow>
      <WindowPane
        header={(
          <div className={styles.head}>
            <span className={styles.headTitle}>{s.inventory.title}</span>
            <div className={styles.search}><SearchInput placeholder={s.common.search} value={query} onChange={(e) => setQuery(e.target.value)} aria-label={s.inventory.searchHint} /></div>
          </div>
        )}
        footer={(
          <>
            {message && <span className={styles.message}>{message}</span>}
            <div className={styles.coins}>{COINS.map((k) => <CoinValue key={k} coin={k} value={wallet[k]} />)}</div>
          </>
        )}>
        <div className={styles.body}>
          {query.trim() ? (
            <div className={styles.results}>
              {!results.length && <span className={styles.note}>{s.common.nothingFound}</span>}
              {results.map((it) => (
                <div key={it.id} className={styles.result}>
                  <img src={iconUrl(it.id)} alt="" />
                  <div className={styles.resultName}><span>{nameOf(it)}</span><span>{price(it.cost)}</span></div>
                  <div className={styles.resultButtons}>
                    <Button variant="primary" onClick={() => get(it.id)}>{s.inventory.get}</Button>
                    <Button variant="light-accent" onClick={() => buy(it.id)} disabled={!it.cost_cp}>{s.inventory.buy}</Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <SlotGrid>
              {seat.inventory.map((c, i) => (
                <InventorySlot key={c?.uid ?? `empty-${i}`} label={c ? itemName(c) : undefined} selected={!!c && c.uid === chosen}
                  mark={c ? slotMark({ equipped: c.equipped, attuned: c.attuned }) : undefined}
                  onClick={() => c && setChosen(c.uid)}>
                  {c && (c.item ? <img className={styles.slotPicture} src={iconUrl(c.item)} alt="" /> : <span className={styles.slotText}>{c.name}</span>)}
                </InventorySlot>
              ))}
            </SlotGrid>
          )}
        </div>
      </WindowPane>
      <WindowPane side width={300} header={<span className={styles.headTitle}>{s.inventory.description}</span>}
        footer={cell && (
          <>
            {(attunable(cell) || attuned > 0) && <span className={styles.note}>{full ? s.inventory.attunementFull(attuned, max) : s.inventory.attuned(attuned, max)}</span>}
            <div className={styles.buttons}>
              <Button stretch onClick={() => onChange(setEquipped(seat, cell.uid, !cell.equipped))}>{cell.equipped ? s.inventory.unequip : s.inventory.equip}</Button>
              {attunable(cell) && (
                <Button variant="light-accent" stretch disabled={full} onClick={() => onChange(setAttuned(seat, cell.uid, !cell.attuned))}>
                  {cell.attuned ? s.inventory.unattune : s.inventory.attune}
                </Button>
              )}
              <IconButton className={styles.remove} label={s.inventory.remove} icon={<Icon name="minus" />} onClick={() => { onChange(removeCell(seat, cell.uid)); setChosen(null) }} />
            </div>
          </>
        )}>
        {cell ? <ItemCard seat={seat} cell={cell} /> : <p className={styles.empty}>{s.inventory.pick}</p>}
      </WindowPane>
    </GameWindow>
  )
}
