import { ColorIcon, Icon, Icon28, PLAYER_COLORS, PlayerIcon, PlayerIcon42, type ColorIconName, type Icon28Name, type IconName, type PlayerIcon42Name, type PlayerIconName } from '../../ui'
import text from '../../ui/tokens/text.module.css'
import { Cell, Row, Section } from '../kit'

const COLOR_GROUPS: [string, string[]][] = [
  ['bg', ['primary', 'secondary', 'tertiary', 'danger', 'info', 'alert', 'scroll', 'chat', 'tooltip']],
  ['txt', ['primary', 'secondary', 'button', 'inactive', 'danger', 'info', 'alert']],
  ['icon', ['primary', 'secondary', 'button', 'inactive', 'danger', 'info', 'alert']],
  ['outline', ['primary', 'danger', 'brand', 'brand-30', 'alert']],
  ['flow', ['red', 'orange', 'yellow', 'green', 'blue', 'indigo', 'purple', 'scarlett']]
]

const ICONS_16: IconName[] = ['arrows.download', 'arrows.import', 'arrows.upload', 'checkbox.checked', 'chevron.down', 'close', 'door', 'edit', 'eraser', 'fog.of.war', 'home', 'media.text', 'minus', 'more.three.dots', 'play', 'plus', 'search', 'wall.barrier', 'wall.bricks']
const ICONS_28: Icon28Name[] = ['map', 'autointent', 'person.human.avatar', 'settings']
const COLOR_ICONS: ColorIconName[] = ['character.coin.P', 'character.coin.G', 'character.coin.S', 'character.coin.M', 'character.eraser']
const PLAYER_ICONS: PlayerIconName[] = ['character.figure.avatar', 'character.pencil']
const PLAYER_ICONS_42: PlayerIcon42Name[] = ['sheet.character', 'sheet.sidekick', 'inventory', 'spells', 'dice']

const SHEET_STYLES = [
  ['sheetTitle', 'Лист персонажа', 'PT Serif Caption 14/28, разрядка 2,8 px, прописные, txt/info'],
  ['sheetHeading', 'Кости хитов', 'PT Serif Caption 14/28, прописные, по центру, txt/info — заголовки разделов'],
  ['sheetLabel', 'Мировоззрение', 'PT Serif Caption 14/28, txt/info — подписи полей'],
  ['sheetCaption', 'Инициатива', 'PT Serif Caption 14/normal, txt/info — подписи в плашках'],
  ['sheetHint', 'Загрузить портрет', 'PT Serif Caption 12/normal, txt/inactive'],
  ['sheetValue', '180', 'Inter Medium 14/28, txt/primary — значения, оценки, бонусы'],
  ['sheetValueUpper', 'Хаотический нейтральный', 'Inter Medium 14/28, прописные — имя, вид, класс'],
  ['sheetNumber', '+3', 'Inter Medium 24/28 — модификаторы, КД, хиты'],
  ['sheetText', 'Уход за животными', 'Inter 14/28 — названия навыков, многострочные поля'],
  ['sheetMuted', '(Мдр)', 'Inter 14/28, txt/secondary — вторая часть строки']
] as const

const swatch = (v: string) => (
  <span style={{ width: 40, height: 28, borderRadius: 'var(--radius-default)', background: `var(${v})`, boxShadow: 'inset 0 0 0 1px var(--outline-primary)' }} />
)

export function Foundation() {
  return (
    <>
      <Section id="colors" title="Цвета" figma="assets/dnd-tokens-dark.json → tokens/colors.css">
        {COLOR_GROUPS.map(([group, names]) => (
          <Row key={group} label={group}>
            {names.map((n) => (
              <Cell key={n} caption={`${group}/${n}`}>{swatch(`--${group}-${n}`)}</Cell>
            ))}
          </Row>
        ))}
      </Section>

      <Section id="text" title="Текст" figma="tokens/text.module.css" note="Стили текста библиотеки и те, что встречаются в макетах без токена.">
        {([['body', 'Inter 12/28, обычный'], ['title', 'Inter 12/28, полужирный'], ['display', 'Inter 14/28, полужирный'], ['multiline', 'Inter 12/18 — описания'], ['caption', 'Inter 12/18'], ['captionStrong', 'Inter 12/18, полужирный']] as const).map(([k, d]) => (
          <Row key={k} label={k}>
            <span className={text[k]}>Потусторонний скакун — {d}</span>
          </Row>
        ))}
      </Section>

      <Section id="sheet-text" title="Текст листа персонажа" figma="D&D VTT / Лист персонажа черновик (41:4939), утверждённый лист app/preview"
        note="Свои правила листа: подписи — PT Serif Caption в цвете txt/info, значения — Inter Medium, строки по 28 px.">
        {SHEET_STYLES.map(([k, sample, d]) => (
          <Row key={k} label={k}>
            <span className={text[k]}>{sample}</span>
            <span className={text.caption} style={{ color: 'var(--txt-secondary)', alignSelf: 'center' }}>{d}</span>
          </Row>
        ))}
        <Row label="вместе">
          <div style={{ width: 360, display: 'flex', flexDirection: 'column', gap: 16, padding: 16, background: 'var(--bg-primary)', boxShadow: 'inset 0 0 0 1px var(--outline-primary)', borderRadius: 12 }}>
            <span className={text.sheetTitle}>Лист персонажа</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <span className={text.sheetLabel}>Класс</span>
              <span className={text.sheetValueUpper} style={{ flex: 1, boxShadow: 'inset 0 -1px 0 var(--sheet-rule)' }}>Воин</span>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {['СИЛ', 'ЛОВ', 'ТЕЛ'].map((a, i) => (
                <div key={a} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: 8, background: 'var(--bg-secondary)', borderRadius: 12, boxShadow: 'inset 0 0 0 1px var(--outline-primary)' }}>
                  <span className={text.sheetCaption}>{a}</span>
                  <span className={text.sheetNumber}>{['+2', '-1', '+1'][i]}</span>
                  <span className={text.sheetValue} style={{ width: '100%', textAlign: 'center', borderRadius: 4, boxShadow: 'inset 0 0 0 1px var(--outline-primary)' }}>{[14, 8, 12][i]}</span>
                </div>
              ))}
            </div>
            <span className={text.sheetHeading}>Навыки</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <span className={text.sheetValue} style={{ width: 32, textAlign: 'center', boxShadow: 'inset 0 -1px 0 var(--sheet-rule)' }}>+4</span>
              <span className={text.sheetText}>Тайная магия</span>
              <span className={text.sheetMuted}>(Инт)</span>
            </div>
          </div>
        </Row>
      </Section>

      <Section id="icons" title="Иконки" figma="assets/icon.*" note="Одноцветные иконки берут цвет из макета; цветные и иконки игроков вставляются как есть.">
        <Row label="icon.16">
          {ICONS_16.map((n) => (
            <Cell key={n} caption={n}><Icon name={n} /></Cell>
          ))}
        </Row>
        <Row label="icon.28">
          {ICONS_28.map((n) => (
            <Cell key={n} caption={n}><Icon28 name={n} /></Cell>
          ))}
        </Row>
        <Row label="icon.16.color">
          {COLOR_ICONS.map((n) => (
            <Cell key={n} caption={n}><ColorIcon name={n} /></Cell>
          ))}
        </Row>
        {PLAYER_ICONS.map((n) => (
          <Row key={n} label={`icon.16.player: ${n.replace('character.', '')}`}>
            {[...PLAYER_COLORS, 'grey' as const].map((c) => (
              <Cell key={c} caption={c}><PlayerIcon name={n} color={c} /></Cell>
            ))}
          </Row>
        ))}
        {PLAYER_ICONS_42.map((n) => (
          <Row key={n} label={`icon.42.player: ${n}`}>
            {[...PLAYER_COLORS, 'grey' as const].map((c) => (
              <Cell key={c} caption={c}><PlayerIcon42 name={n} color={c} /></Cell>
            ))}
          </Row>
        ))}
      </Section>
    </>
  )
}
