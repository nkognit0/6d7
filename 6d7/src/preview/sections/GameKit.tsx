import { useState } from 'react'
import {
  Avatar, Button, CampaignCard, CoinValue, ColorIcon, Divider, GameMenuButton, GameWindow, Icon, IconButton, InventorySlot, InviteCode,
  Modal, NpcCard, NumberField, Overlay, Plate, PLAYER_COLORS, PlayerIcon, PlayerRow, RowField, SearchInput, Select, SettingRow, Slider,
  SlotGrid, SpellSlotRow, TextInput, WindowPane, type PlayerColor, type PlayerIcon42Name, type SlotMark
} from '../../ui'
import text from '../../ui/tokens/text.module.css'
import { Cell, Row, Section } from '../kit'

const NAV: [PlayerIcon42Name, string][] = [['sheet.character', 'Лист персонажа'], ['sheet.sidekick', 'Лист спутника'], ['inventory', 'Инвентарь'], ['spells', 'Заклинания'], ['dice', 'Кости']]
const TOKEN = (r: string) => `${import.meta.env.BASE_URL}tokens/npc-goblin-${r}.webp`
// [frame, selected, caption]
const SLOTS: [SlotMark | undefined, boolean, string][] = [
  [undefined, false, 'обычное'], [undefined, true, 'выбрано'], ['equipped', false, 'экипировано'], ['equipped', true, 'экипировано и выбрано'],
  ['attuned', false, 'настройка'], ['attuned', true, 'настройка и выбрано']
]

export function GameKit() {
  const [color, setColor] = useState<PlayerColor>('orange')
  const [open, setOpen] = useState<PlayerIcon42Name | null>('dice')
  const [tool, setTool] = useState<'figure' | 'pencil' | 'eraser'>('pencil')
  const [size, setSize] = useState(1)
  const [brush, setBrush] = useState(4)
  const [x, setX] = useState(0)
  const [y, setY] = useState(0)
  const [selectedNpc, setSelectedNpc] = useState('common')
  const [slots, setSlots] = useState([2, 1, 0])
  const [moving, setMoving] = useState(true)
  const [overlay, setOverlay] = useState(false)
  const [dice, setDice] = useState<'d20' | 'd6'>('d20')
  return (
    <>
      <Section id="game-nav" title="Навигация игрока" figma="D&D VTT / assets / menu (28:434); top-panel plates (43:7044, 41:5994; обводки 61:4259, 61:3985, 61:4464)" note="Крупные кнопки 58 px в цвете игрока (серый — мастер) и плашки кластеров: линия со всех сторон, кроме краёв экрана, к которым плашка прижата. Выберите цвет и нажимайте кнопки.">
        <Row label="цвет">
          <Select value={color} onChange={setColor} options={[...PLAYER_COLORS, 'grey' as const].map((c) => ({ value: c, label: c }))} aria-label="Цвет игрока" />
        </Row>
        <Row label="menu">
          <Cell caption="обычное"><GameMenuButton icon="sheet.character" color={color} label="Лист" /></Cell>
          <Cell caption="наведение"><GameMenuButton icon="sheet.character" color={color} label="Лист" previewState="hover" /></Cell>
          <Cell caption="открыто"><GameMenuButton icon="sheet.character" color={color} label="Лист" open /></Cell>
        </Row>
        <Row label="плашки">
          <Plate edge="left">
            {NAV.map(([icon, label]) => (
              <GameMenuButton key={icon} icon={icon} color={color} label={label} open={open === icon} onClick={() => setOpen(open === icon ? null : icon)} />
            ))}
          </Plate>
          <Plate edge="right">
            <IconButton variant="switch" pressed={tool === 'figure'} onClick={() => setTool('figure')} label="Фишка" icon={<PlayerIcon name="character.figure.avatar" color={color} />} />
            <IconButton variant="switch" pressed={tool === 'pencil'} onClick={() => setTool('pencil')} label="Карандаш" icon={<PlayerIcon name="character.pencil" color={color} />} />
            <IconButton variant="switch" pressed={tool === 'eraser'} onClick={() => setTool('eraser')} label="Ластик" icon={<ColorIcon name="character.eraser" />} />
          </Plate>
          <Plate edge="top" direction="row">
            {NAV.slice(0, 4).map(([icon, label]) => (
              <GameMenuButton key={icon} icon={icon} color={color} label={label} />
            ))}
          </Plate>
          <Plate edge={['left', 'bottom']} direction="row">
            <GameMenuButton icon="dice" color="grey" label="Кости" />
            {(['orange', 'green', 'blue'] as const).map((c) => (
              <IconButton key={c} label={`Фишка: ${c}`} icon={<PlayerIcon name="character.figure.avatar" color={c} />} />
            ))}
          </Plate>
        </Row>
      </Section>

      <Section id="map-tools" title="Слайдер и координаты" figma="D&D VTT / editor / map toolbar (9:683)" note="Размер сетки, толщина кисти тумана, смещение сетки по X и Y. Как в Figma, значение поля меняется перетаскиванием подписи: размер и X — влево-вправо, Y — вверх-вниз; шаг размера 0,01, с Shift шаг в 10 раз больше.">
        <Row label="примеры">
          <Cell caption="размер сетки" width={216}><NumberField label="Размер сетки" value={size} min={1} max={10} step={0.01} onChange={setSize} /></Cell>
          <Cell caption="кисть тумана" width={216}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, width: '100%' }}>
              <IconButton variant="chat" label="Кисть тумана" icon={<Icon name="fog.of.war" />} />
              <Slider value={brush} min={1} max={20} onChange={setBrush} aria-label="Толщина кисти" />
              <IconButton variant="chat" label="Ластик тумана" icon={<Icon name="eraser" />} />
            </div>
          </Cell>
          <Cell caption="смещение сетки" width={216}>
            <div style={{ display: 'flex', gap: 4, width: '100%' }}>
              <NumberField label="X" value={x} onChange={setX} />
              <NumberField label="Y" scrub="y" value={y} onChange={setY} />
            </div>
          </Cell>
        </Row>
      </Section>

      <Section id="slots" title="InventorySlot, SlotGrid" figma="D&D VTT / game / inventory-slot (33:6735)"
        note="Ярко-синяя рамка — экипировано (у заклинаний — подготовлено), жёлтая — магическая настройка. Выбранная для описания ячейка залита, как кнопки игрока при наведении, — рамке это не мешает. В сетке клетки квадратные, 80–100 px, и заполняют всю ширину: колонок столько, сколько влезает.">
        <Row label="состояния">
          {SLOTS.map(([m, selected, caption]) => (
            <Cell key={caption} caption={caption}>
              <InventorySlot mark={m} selected={selected} label="Предмет"><img src={TOKEN('common')} alt="" /></InventorySlot>
            </Cell>
          ))}
          <Cell caption="пустая"><InventorySlot /></Cell>
        </Row>
        <Row label="сетка — потяните край">
          <div style={{ width: 520, minWidth: 180, maxWidth: '100%', resize: 'horizontal', overflow: 'hidden', padding: 'var(--spacer-m)', boxShadow: 'inset 0 0 0 1px var(--outline-primary)', borderRadius: 'var(--radius-default)' }}>
            <SlotGrid>
              {SLOTS.map(([m, selected], i) => <InventorySlot key={i} mark={m} selected={selected} label="Предмет"><img src={TOKEN('common')} alt="" /></InventorySlot>)}
              {Array.from({ length: 10 }, (_, i) => <InventorySlot key={`e${i}`} />)}
            </SlotGrid>
          </div>
        </Row>
      </Section>

      <Section id="npc-cards" title="Карточки NPC" figma="D&D VTT / editor (14:1451, 13:1179, 40:3918)">
        <Row label="плитка каталога">
          {(['common', 'rare', 'legendary'] as const).map((r) => (
            <NpcCard key={r} image={TOKEN(r)} name="Гоблин" note={r === 'common' ? 'Обычный' : r === 'rare' ? 'Редкий' : 'Легендарный'}
              selected={selectedNpc === r} onClick={() => setSelectedNpc(r)} />
          ))}
        </Row>
        <Row label="строка списка">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: 216 }}>
            {(['common', 'rare'] as const).map((r) => (
              <NpcCard key={r} layout="list" image={TOKEN(r)} name="Гоблин" note={r === 'common' ? 'Обычный' : 'Редкий'} />
            ))}
          </div>
        </Row>
        <Row label="превью">
          <div style={{ width: 295 }}><NpcCard layout="preview" image={TOKEN('legendary')} name="Гоблин" note="Легендарный" /></div>
        </Row>
      </Section>

      <Section id="campaign-card" title="Карточка кампании" figma="D&D VTT / home (17:1630)">
        <Row label="пример">
          <div style={{ width: 330 }}>
            <CampaignCard
              name="Подземелья Аболета"
              players={[{ name: 'Иван', color: 'orange' }, { name: 'Вера', color: 'yellow' }, { name: 'Фёдор', color: 'blue' }, { name: 'Рита', color: 'scarlett' }]}
              actions={<><Button>Играть</Button><Button variant="primary">Редактировать</Button></>}
            />
          </div>
        </Row>
      </Section>

      <Section id="rows-game" title="Строки игроков, настроек, монет и ячеек" figma="D&D VTT (14:1568, 41:4128, 34:6919, 34:7386)">
        <Row label="игрок">
          <div style={{ width: 560 }}>
            <PlayerRow avatar={<Avatar name="Макар" color="green" />} name={<TextInput defaultValue="Макар" placeholder="Введите имя игрока…" />}
              code={<InviteCode code="K7Q-2MX-9D4" />} action={<IconButton label="Удалить игрока" icon={<Icon name="minus" />} />} />
          </div>
        </Row>
        <Row label="настройка">
          <div style={{ width: 480 }}>
            <SettingRow title="Свободное перемещение" description="Игроки могут сами перемещать свои фишки по карте." checked={moving} onChange={setMoving} />
          </div>
        </Row>
        <Row label="монеты">
          <CoinValue coin="pp" value={2} /><CoinValue coin="gp" value={67} /><CoinValue coin="sp" value={14} /><CoinValue coin="cp" value={3} />
        </Row>
        <Row label="ячейки заклинаний">
          <div style={{ width: 240, background: 'var(--bg-secondary)' }}>
            {[4, 3, 2].map((total, i) => (
              <SpellSlotRow key={i} level={i + 1} total={total} used={slots[i]} onChange={(u) => setSlots(slots.map((s, j) => (j === i ? u : s)))} />
            ))}
          </div>
        </Row>
      </Section>

      <Section id="windows" title="Окна" figma="D&D VTT / game (34:7794 modal/dice, 33:6729 окно инвентаря, 30:4208 оверлей)" note="Маленькое окно костей, большое окно с панелями и оверлей под окнами (откройте кнопкой).">
        <Row label="окно костей">
          <Modal title="Бросить кости" onClose={() => {}}>
            <RowField label="Количество"><TextInput defaultValue="1" inputMode="numeric" /></RowField>
            <RowField label="Кости"><Select value={dice} onChange={setDice} options={[{ value: 'd20', label: 'd20' }, { value: 'd6', label: 'd6' }]} /></RowField>
            <Button stretch>Бросить</Button>
            <Divider />
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <span style={{ font: 'var(--font-navigation)', flex: 1 }}>Результат:</span>
              <span style={{ font: 'var(--font-result)', color: 'var(--txt-info)' }}>12</span>
            </div>
          </Modal>
        </Row>
        <Row label="окно с панелями">
          <div style={{ width: '100%', height: 360, display: 'flex' }}>
            <GameWindow>
              <WindowPane header={<div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span className={text.title} style={{ flex: 1 }}>Инвентарь</span><div style={{ width: 200 }}><SearchInput /></div></div>}
                footer={<div style={{ display: 'flex' }}><CoinValue coin="pp" value={2} /><CoinValue coin="gp" value={67} /><CoinValue coin="sp" value={14} /><CoinValue coin="cp" value={3} /></div>}>
                <div style={{ padding: '16px 24px' }}>
                  <SlotGrid>
                    {SLOTS.map(([m, selected], i) => <InventorySlot key={i} mark={m} selected={selected} label="Предмет"><img src={TOKEN('common')} alt="" /></InventorySlot>)}
                    {Array.from({ length: 8 }, (_, i) => <InventorySlot key={`e${i}`} />)}
                  </SlotGrid>
                </div>
              </WindowPane>
              <WindowPane side width={280} header={<span className={text.title}>Описание предмета</span>}
                footer={<div style={{ display: 'flex', gap: 8 }}><Button stretch>Экипировать</Button><Button variant="light-accent" stretch>Маг. настройка</Button><Button variant="primary" stretch>Удалить</Button></div>} />
            </GameWindow>
          </div>
        </Row>
        <Row label="оверлей">
          <Button variant="primary" onClick={() => setOverlay(true)}>Показать оверлей</Button>
          {overlay && (
            <Overlay onClose={() => setOverlay(false)}>
              <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}>
                <Modal title="Нажмите мимо окна" onClose={() => setOverlay(false)}><span className={text.multiline}>Оверлей: чёрный 40% и размытие фона 8 px.</span></Modal>
              </div>
            </Overlay>
          )}
        </Row>
      </Section>
    </>
  )
}
