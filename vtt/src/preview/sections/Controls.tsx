import { useState } from 'react'
import { shortcutLabel } from '../../app/shortcuts'
import {
  Avatar, Button, Checkbox, ContextMenu, Icon, IconButton, InlineEdit, Menu, MenuDivider, MenuItem, PLAYER_COLORS, SearchInput, Select, Switch, TextInput,
  useContextMenu, type ButtonVariant, type IconButtonVariant
} from '../../ui'
import { Cell, Row, Section, STATES } from '../kit'

const BUTTONS: [ButtonVariant, string][] = [['brand', 'brand'], ['primary', 'primary'], ['secondary', 'secondary'], ['light-accent', 'light-accent']]
const ICON_BUTTONS: [IconButtonVariant, string][] = [['primary', 'button-icon-primary'], ['switch', 'button-icon-switch'], ['chat', 'button-chat']]
const DICE = ['d4', 'd6', 'd8', 'd10', 'd12', 'd20', 'd100'] as const

export function Controls() {
  const [sw, setSw] = useState(true)
  const [cb, setCb] = useState(true)
  const [pressed, setPressed] = useState(false)
  const [dice, setDice] = useState<(typeof DICE)[number] | null>('d20')
  const [name, setName] = useState('Макар')
  const [title, setTitle] = useState('Проклятие Страда')
  const [renaming, setRenaming] = useState(false)
  const [picked, setPicked] = useState('—')
  const context = useContextMenu()
  return (
    <>
      <Section id="button" title="Button" figma="Buttons / button-large (4:324)" note="Главная кнопка — brand; обычная — primary; текстовая — secondary; спокойный акцент — light-accent («Присоединиться к игре»).">
        {BUTTONS.map(([v, label]) => (
          <Row key={v} label={label}>
            {STATES.map((s) => (
              <Cell key={s.label} caption={s.label}><Button variant={v} previewState={s.key}>Создать</Button></Cell>
            ))}
            <Cell caption="неактивное"><Button variant={v} disabled>Создать</Button></Cell>
          </Row>
        ))}
        <Row label="с иконкой и во всю ширину">
          <Cell caption="icon" width={216}><Button variant="primary" icon={<Icon name="arrows.import" />} stretch>Загрузить изображение</Button></Cell>
          <Cell caption="stretch" width={216}><Button stretch>Сохранить</Button></Cell>
        </Row>
      </Section>

      <Section id="icon-button" title="IconButton" figma="Buttons / button-icon-primary (1:1325), button-icon-switch (1:1334), button-chat (333:1668)">
        {ICON_BUTTONS.map(([v, label]) => (
          <Row key={v} label={label}>
            {STATES.map((s) => (
              <Cell key={s.label} caption={s.label}><IconButton variant={v} label="Туман" icon={<Icon name="fog.of.war" />} previewState={s.key} /></Cell>
            ))}
            {v === 'switch' && <Cell caption="включено"><IconButton variant="switch" pressed label="Туман" icon={<Icon name="fog.of.war" />} /></Cell>}
            <Cell caption="неактивное"><IconButton variant={v} label="Туман" icon={<Icon name="fog.of.war" />} disabled /></Cell>
          </Row>
        ))}
        <Row label="живой пример">
          <Cell caption="переключается по нажатию"><IconButton variant="switch" pressed={pressed} onClick={() => setPressed(!pressed)} label="Карандаш" icon={<Icon name="edit" />} /></Cell>
          <Cell caption="ряд объектов редактора" width={216}>
            <div style={{ display: 'flex', gap: 4, width: '100%' }}>
              {(['home', 'wall.bricks', 'wall.barrier', 'door', 'eraser'] as const).map((n) => (
                <IconButton key={n} variant="chat" stretch label={n} icon={<Icon name={n} />} />
              ))}
            </div>
          </Cell>
        </Row>
      </Section>

      <Section id="switch" title="Switch" figma="Switches / switch (1:1261)">
        <Row label="выключен">
          <Cell caption="обычное"><Switch checked={false} aria-label="Сетка" /></Cell>
          <Cell caption="фокус"><Switch checked={false} previewState="focus" aria-label="Сетка" /></Cell>
          <Cell caption="неактивное"><Switch checked={false} disabled aria-label="Сетка" /></Cell>
        </Row>
        <Row label="включён">
          <Cell caption="обычное"><Switch checked aria-label="Сетка" /></Cell>
          <Cell caption="фокус"><Switch checked previewState="focus" aria-label="Сетка" /></Cell>
          <Cell caption="неактивное"><Switch checked disabled aria-label="Сетка" /></Cell>
        </Row>
        <Row label="живой пример">
          <Cell caption="с подписью"><Switch checked={sw} onChange={setSw} label="Показывать игрокам" /></Cell>
        </Row>
      </Section>

      <Section id="checkbox" title="Checkbox" figma="Checkboxes / checkbox (5:286)">
        {[false, true].map((on) => (
          <Row key={String(on)} label={on ? 'отмечен' : 'не отмечен'}>
            <Cell caption="обычное"><Checkbox checked={on} aria-label="Ячейка" /></Cell>
            <Cell caption="наведение"><Checkbox checked={on} previewState="hover" aria-label="Ячейка" /></Cell>
            <Cell caption="фокус"><Checkbox checked={on} previewState="focus" aria-label="Ячейка" /></Cell>
            <Cell caption="неактивное"><Checkbox checked={on} disabled aria-label="Ячейка" /></Cell>
          </Row>
        ))}
        <Row label="живой пример">
          <Cell caption="с подписью"><Checkbox checked={cb} onChange={setCb} label="Акробатика" /></Cell>
        </Row>
      </Section>

      <Section id="avatar" title="Avatar" figma="Avatars / avatar (26:711)" note="Кружок цвета игрока с первой буквой имени или картинка.">
        <Row label="цвета игроков">
          {PLAYER_COLORS.map((c) => (
            <Cell key={c} caption={c}><Avatar name={c === 'orange' ? 'Иван' : 'Олег'} color={c as Exclude<typeof c, "grey">} /></Cell>
          ))}
        </Row>
        <Row label="на карточке кампании">
          <Cell caption="ring, внахлёст">
            <div style={{ display: 'flex' }}>
              {(['orange', 'yellow', 'blue', 'scarlett'] as const).map((c, i) => (
                <Avatar key={c} name="Игрок" color={c} ring style={{ marginLeft: i ? -14 : 0 }} />
              ))}
            </div>
          </Cell>
        </Row>
      </Section>

      <Section id="text-input" title="TextInput" figma="Input fields / text-input-line (7:779)">
        {STATES.map((s) => (
          <Row key={s.label} label={s.label}>
            <Cell caption="пустое" width={216}><TextInput placeholder="Введите имя игрока…" previewState={s.key} /></Cell>
            <Cell caption="с текстом" width={216}><TextInput defaultValue="Макар" previewState={s.key} /></Cell>
          </Row>
        ))}
        <Row label="проверка">
          <Cell caption="alert" width={216}><TextInput defaultValue="Макар" status="alert" /></Cell>
          <Cell caption="error" width={216}><TextInput defaultValue="Макар" status="error" /></Cell>
          <Cell caption="неактивное" width={216}><TextInput defaultValue="Макар" disabled /></Cell>
        </Row>
        <Row label="живой пример">
          <Cell caption={`значение: ${name}`} width={216}><TextInput value={name} onChange={(e) => setName(e.target.value)} /></Cell>
        </Row>
      </Section>

      <Section id="search-input" title="SearchInput" figma="Input fields / text-input-search (7:805)">
        {STATES.map((s) => (
          <Row key={s.label} label={s.label}>
            <Cell caption="пустое" width={240}><SearchInput previewState={s.key} /></Cell>
            <Cell caption="с текстом" width={240}><SearchInput defaultValue="Аболет" previewState={s.key} /></Cell>
          </Row>
        ))}
        <Row label="неактивное">
          <Cell caption="пустое" width={240}><SearchInput disabled /></Cell>
        </Row>
      </Section>

      <Section id="inline-edit" title="InlineEdit" figma="нет в макете: text-input-line (7:779) в фокусе" note="Название, которое становится полем: кампания в верхней панели редактора и на плитке. Enter или щелчок мимо — сохранить, Escape — отменить; пустое название не сохраняется. Шрифт — как у места, где стоит название.">
        <Row label="живой пример">
          <Cell caption="двойной щелчок — переименовать" width={240}>
            <div style={{ font: 'var(--font-display)', color: 'var(--txt-primary)', height: 28, display: 'flex', alignItems: 'center' }} onDoubleClick={() => setRenaming(true)}>
              {renaming ? <InlineEdit value={title} aria-label="Название кампании" onDone={(v) => { if (v) setTitle(v); setRenaming(false) }} /> : <span style={{ padding: '0 8px' }}>{title}</span>}
            </div>
          </Cell>
        </Row>
      </Section>

      <Section id="select" title="Select" figma="Dropdowns / dropdown-text (20:925)">
        <Row label="состояния">
          <Cell caption="пустое" width={160}><Select value={null} options={[]} onChange={() => {}} /></Cell>
          <Cell caption="наведение" width={160}><Select value="d20" options={[{ value: 'd20', label: 'd20' }]} onChange={() => {}} previewState="hover" /></Cell>
          <Cell caption="открыто" width={160}><Select value="d20" options={[{ value: 'd20', label: 'd20' }]} onChange={() => {}} previewState="active" /></Cell>
          <Cell caption="alert" width={160}><Select value="d20" options={[{ value: 'd20', label: 'd20' }]} onChange={() => {}} status="alert" /></Cell>
          <Cell caption="error" width={160}><Select value="d20" options={[{ value: 'd20', label: 'd20' }]} onChange={() => {}} status="error" /></Cell>
          <Cell caption="неактивное" width={160}><Select value="d20" options={[{ value: 'd20', label: 'd20' }]} onChange={() => {}} disabled /></Cell>
        </Row>
        <Row label="живой пример">
          <Cell caption="кости" width={160}><Select value={dice} onChange={setDice} options={DICE.map((d) => ({ value: d, label: d }))} aria-label="Кости" /></Cell>
        </Row>
      </Section>

      <Section id="menu" title="Menu" figma="Menu items / item (24:1292), icon-item (24:1973), divider (24:1305)" note="Панель выпадающих меню: меню кампании, пользователя, «…» у карты, «Отдых».">
        <Row label="пример">
          <Menu>
            <MenuItem>Сохранить</MenuItem>
            <MenuItem previewState="hover">Экспортировать</MenuItem>
            <MenuItem disabled>Импортировать</MenuItem>
            <MenuDivider />
            <MenuItem icon={<Icon name="home" />}>На главный экран</MenuItem>
            <MenuItem icon={<Icon name="edit" />} hint="F2">Переименовать</MenuItem>
          </Menu>
        </Row>
      </Section>

      <Section id="context-menu" title="ContextMenu" figma="Menu items (24:1913, 24:1309)" note="Меню в точке щелчка правой кнопкой: плитка кампании («Переименовать», «Удалить»). Не выходит за край окна; закрывается щелчком мимо, Escape, прокруткой и выбором пункта. Подсказки горячих клавиш — из общей таблицы команд.">
        <Row label="живой пример">
          <Cell caption={`выбрано: ${picked}`} width={240}>
            <div onContextMenu={context.open} style={{ height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8, boxShadow: 'inset 0 0 0 1px var(--outline-primary)', color: 'var(--txt-secondary)', font: 'var(--font-body)' }}>
              Щелчок правой кнопкой
            </div>
            <ContextMenu at={context.at} onClose={context.close}>
              <MenuItem hint={shortcutLabel('undo')} onClick={() => setPicked('Отменить')}>Отменить</MenuItem>
              <MenuItem hint={shortcutLabel('redo')} disabled>Повторить</MenuItem>
              <MenuDivider />
              <MenuItem onClick={() => setPicked('Переименовать')}>Переименовать</MenuItem>
              <MenuItem onClick={() => setPicked('Удалить')}>Удалить</MenuItem>
            </ContextMenu>
          </Cell>
        </Row>
      </Section>
    </>
  )
}
