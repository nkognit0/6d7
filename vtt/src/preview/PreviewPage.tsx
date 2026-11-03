import { useEffect } from 'react'
import { Controls } from './sections/Controls'
import { Foundation } from './sections/Foundation'
import { GameKit } from './sections/GameKit'
import { Layout } from './sections/Layout'
import styles from './preview.module.css'

// table of contents: [section id, title], grouped like the library
const NAV: [string, [string, string][]][] = [
  ['Основа', [['colors', 'Цвета'], ['text', 'Текст'], ['sheet-text', 'Текст листа'], ['icons', 'Иконки']]],
  ['Элементы управления', [['button', 'Button'], ['icon-button', 'IconButton'], ['switch', 'Switch'], ['checkbox', 'Checkbox'], ['avatar', 'Avatar']]],
  ['Поля и меню', [['text-input', 'TextInput'], ['search-input', 'SearchInput'], ['inline-edit', 'InlineEdit'], ['textarea', 'Textarea'], ['select', 'Select'], ['menu', 'Menu'], ['context-menu', 'ContextMenu'], ['menu-buttons', 'ProjectMenu, UserMenu']]],
  ['Навигация и панели', [['nav', 'NavTab, NavPage'], ['bars', 'TopPanel, BottomNavigation'], ['sidebar', 'Боковая панель'], ['scroll', 'ScrollArea'], ['confirm', 'ConfirmDialog']]],
  ['Элементы D&D VTT', [['game-nav', 'Навигация игрока'], ['map-tools', 'Слайдер и координаты'], ['slots', 'InventorySlot'], ['npc-cards', 'Карточки NPC'], ['campaign-card', 'Карточка кампании'], ['rows-game', 'Строки и ячейки'], ['windows', 'Окна']]]
]

/**
 * Every component of the library with its states, for checking against Figma. `section` — the
 * component of the address #preview/<id>: the page scrolls to it.
 */
export function PreviewPage({ section }: { section?: string }) {
  useEffect(() => {
    if (section) document.getElementById(section)?.scrollIntoView()
  }, [section])
  return (
    <div className={styles.page}>
      <nav className={styles.nav}>
        <h1 className={styles.navTitle}>Компоненты</h1>
        <a className={styles.navLink} href="#/">Приложение</a>
        <a className={styles.navLink} href="#map">Карта — прототип</a>
        <a className={styles.navLink} href="#sheet">Листы и инвентари — демо</a>
        {NAV.map(([group, items]) => (
          <div key={group} style={{ display: 'contents' }}>
            <span className={styles.navGroup}>{group}</span>
            {items.map(([id, title]) => (
              <a key={id} className={styles.navLink} href={`#preview/${id}`}>{title}</a>
            ))}
          </div>
        ))}
      </nav>
      <main className={styles.content}>
        <p className={styles.intro}>
          Библиотека интерфейса D&D VTT по макету Figma и UI Library. У каждого компонента показаны все состояния;
          блок «живой пример» работает по-настоящему. Наведите, нажмите, перейдите Tab — состояния те же.
        </p>
        <Foundation />
        <Controls />
        <Layout />
        <GameKit />
      </main>
    </div>
  )
}
