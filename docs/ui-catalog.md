# Каталог компонентов VTT

Библиотека: `vtt/src/ui/` (импорт — `vtt/src/ui/index.ts`). Страница-превью со всеми компонентами и состояниями открывается на dev-сервере `vtt`: http://127.0.0.1:5176/.

Компоненты сняты из UI Library (Chatsky Team) — только те, что встречаются в D&D VTT, — и из самого файла D&D VTT. Цвета — `assets/dnd-tokens-dark.json` → `tokens/colors.css` (`npm run tokens`), иконки — `assets/icon.*` → `ui/icons/svg` (`npm run icons`).

## Правила

- Только токены: цвета `--txt-*`, `--bg-*`, `--icon-*`, `--outline-*`, `--flow-*`; отступы `--spacer-*`; скругления `--radius-*`; текст `font: var(--font-*)`; тени `--elevation-*`.
- Состояния (наведение, нажатие, фокус, неактивное) берутся из браузера; `previewState` закрепляет их на странице-превью.
- Никаких плавных переходов и анимаций между состояниями.

## Основа (`ui/tokens`, `ui/icons`)

| Что | Где |
|---|---|
| 44 цвета тёмной темы | `tokens/colors.css` |
| Отступы, скругления, тени, оверлей, стили текста (`--font-body`, `title`, `display`, `navigation`, `multiline`, `caption`, `caption-bold`, `result`) | `tokens/foundation.css` |
| Классы текста для экранов | `tokens/text.module.css` |
| Стили листа персонажа (`--font-sheet-*`, `--letter-spacing-sheet-title`, `--sheet-rule`, `--sheet-rule-active`) и классы `sheet*` | `tokens/foundation.css`, `tokens/text.module.css` |

### Текст листа персонажа

Свои правила листа (D&D VTT «Лист персонажа черновик» `41:4939` и утверждённый лист `app/preview`): подписи — PT Serif Caption в txt/info, значения — Inter Medium в txt/primary, строки по 28 px. Цвет входит в класс.

| Класс | Стиль | Где в листе |
|---|---|---|
| `sheetTitle` | PT Serif Caption 14/28, разрядка 2,8 px, прописные, по центру, txt/info | «ЛИСТ ПЕРСОНАЖА» |
| `sheetHeading` | PT Serif Caption 14/28, прописные, по центру, txt/info | Заголовки разделов: Навыки, Бой, Хиты, Кости хитов, Спасброски от смерти |
| `sheetLabel` | PT Serif Caption 14/28, txt/info | Подписи полей: Имя, Уровень, Класс; заголовок полосы «Спасброски» |
| `sheetCaption` | PT Serif Caption 14/normal, txt/info | Подписи в плашках: СИЛ, КД, Инициатива, Текущие, Успехи |
| `sheetHint` | PT Serif Caption 12/normal, txt/inactive | «Загрузить портрет» |
| `sheetValue` | Inter Medium 14/28, txt/primary | Значения полей, оценки характеристик, бонусы навыков |
| `sheetValueUpper` | Inter Medium 14/28, прописные, txt/primary | Имя, вид, класс, мировоззрение |
| `sheetNumber` | Inter Medium 24/28, txt/primary | Модификаторы, КД, инициатива, скорость, хиты, кости хитов |
| `sheetText` | Inter 14/28, txt/primary | Названия навыков, многострочные поля |
| `sheetMuted` | Inter 14/28, txt/secondary | Вторая часть строки: «(Лов)» после навыка |

Линии полей: подчёркивание значения и линейка многострочного поля (шаг 28 px) — `--sheet-rule` (txt/inactive), в фокусе — `--sheet-rule-active` (txt/info).
| `Icon` (16), `Icon28`, `ColorIcon`, `PlayerIcon` (16, 9 цветов), `PlayerIcon42` | `icons/Icon.tsx` |

## Компоненты UI Library

| Компонент | Figma | Где |
|---|---|---|
| Button: brand, primary, secondary, light-accent | button-large `4:324` | `components/Button` |
| IconButton: primary, switch, chat (у chat с `pressed` — выбранный инструмент: рамка фокуса на подложке bg/info) | `1:1325`, `1:1334`, `333:1668` | `components/IconButton` |
| Switch | switch `1:1261` | `components/Switch` |
| Checkbox | checkbox `5:286` | `components/Checkbox` |
| Avatar | avatar `26:711` | `components/Avatar` |
| TextInput, SearchInput (рамка alert и error видна и в фокусе) | `7:779`, `7:805` | `components/TextInput` |
| Textarea | text-input-multiline `7:1113` | `components/Textarea` |
| Select | dropdown-text `20:925` | `components/Select` |
| Menu, MenuItem, MenuDivider, Popover | `24:1913`, `24:1292`, `24:1305` | `components/Menu` |
| ContextMenu, useContextMenu — меню в точке щелчка правой кнопкой (не выходит за край окна; закрывается щелчком мимо, Escape, прокруткой, выбором пункта) | `24:1913`, `24:1309` | `components/Menu` |
| InlineEdit — название, которое становится полем (рамка text-input-line в фокусе, шрифт места; Enter или щелчок мимо — сохранить, Escape — отменить) | нет в макете, `7:779` | `components/TextInput` |
| ConfirmDialog — вопрос перед тем, что нельзя отменить (окно modal/dice по центру поверх оверлея, фокус на «Отмена») | нет в макете, `34:7794`, `30:4208` | `components/Modal` |
| ProjectMenu, UserMenu (без пунктов меню ничего не открывает) | `26:749`, `26:743` | `components/MenuButton` |
| NavTab, NavPage | `27:1960`, `27:1948` | `components/Nav` |
| TopPanel, BottomNavigation | `100:3404`, `100:3004` | `components/Bars` |
| ModeSwitch — переключатель режимов редактора («Редактирование», «Глазами игрока»): кнопки на подложке bg/tertiary, выбранная — на icon/button с тенью | top-panel / mode-switch (D&D VTT `6:422`) | `components/ModeSwitch` |
| SidebarSection, SidebarTitle, RowTitle | `887:4304`, `887:4452`, `32:2409` | `components/Sidebar` |
| RowSubtitle, RowField (line, dropdown, multiline), RowSwitch, RowCard, RowTabs | `32:2770`, `32:3139`, `32:3950`, `32:3870`, `38:247`, `89:1647`, `329:879` | `components/Rows` |
| ScrollArea; скроллбар всего приложения (12 px, ползунок bg/scroll, без дорожки и стрелок) | scroll-bar `1:1382`, D&D VTT `14:1470` | `components/ScrollArea`, `ui/scrollbar.css` |
| Divider, Modal | `24:1305`; modal/dice `34:7794` | `components/Modal` |

## Элементы D&D VTT

| Компонент | Figma (D&D VTT) | Где |
|---|---|---|
| GameMenuButton — кнопка навигации 58 px | menu `28:434` | `components/Game` |
| Plate — плашки кластеров кнопок; линия outline/primary со всех сторон, кроме краёв экрана из `edge` (одна сторона или две — угол) | `43:7044`, `41:5994`; обводки `61:4259`, `61:3985`, `61:4464` | `components/Game` |
| Slider, NumberField (X, Y, размер сетки; значение меняется перетаскиванием подписи, как в Figma: `scrub` x/y, `step`, `min`/`max`) | `9:686`, `9:749` | `components/Slider` |
| InventorySlot (рамки `equipped`, `attuned`; `selected` — заливка bg/info), SlotGrid (квадратные клетки 80–100 px на всю ширину, число колонок — `slotColumns`) | `33:6735` | `components/InventorySlot` |
| NpcCard: grid, list, preview (имя и подпись — в одну строку с многоточием) | `14:1451`, `13:1179`, `40:3918` | `components/Cards` |
| CampaignCard (название — текст или поле InlineEdit; принимает обработчики, например правый щелчок) | `17:1630` | `components/Cards` |
| PlayerRow, InviteCode (строка 45 px: линия под строкой — под отступом 8 px) | `14:1568`, `14:1569` | `components/Game` |
| SettingRow (строка 63 px, линия — под отступом) | `41:4128` | `components/Game` |
| CoinValue | `34:6919` | `components/Game` |
| SpellSlotRow | `34:7386` | `components/Game` |
| GameWindow, WindowPane | `33:6729`, `33:6800` | `components/Window` |
| Overlay — чёрный 40% и размытие 8 px | `30:4208` | `components/Modal` |

## Листы и инвентари игрока (`vtt/src/game/`)

Не компоненты библиотеки, а части экранов игры; собраны из компонентов выше. Демо — http://127.0.0.1:5176/#sheet.

| Что | Где |
|---|---|
| Лист персонажа (утверждённый лист `app/preview` в тёмной теме, с блоком «Обзор» и использованиями умений) | `game/sheet/CharacterSheet.tsx` |
| Лист спутника (с блоком погибшего спутника и «Вернуть спутника») | `game/sheet/CompanionSheet.tsx` |
| Общие детали листа: поле, число, текст на линейках, карточка, клетки счёта, картинка | `game/sheet/parts.tsx`, `Sheet.module.css` |
| Инвентарь предметов (GameWindow: сетка SlotGrid, поиск, монеты, описание, кнопки; «Удалить» — IconButton `minus`) | `game/inventory/ItemsWindow.tsx` |
| Инвентарь заклинаний (сетка SlotGrid, фильтры, поиск, «Подготовлено N из M» внизу сетки (body, секция 44 px, как ряд кнопок), описание, ячейки заклинаний; всегда подготовленные — в рамке «подготовлено», пометка — в конце описания; «Удалить» — IconButton `minus`; у ячеек заклинаний нет кнопки «Сбросить») | `game/inventory/SpellsWindow.tsx` |
| Карточка описания (заголовок, факты в две колонки, текст, пометка в конце) | `game/inventory/Card.tsx` |
| Окна инвентарей на телефоне (< 768 px): одна панель за раз, шапка «Назад» + название (`BackHead`), «Ячейки заклинаний» внизу окна заклинаний; хук ширины `useNarrow` | `game/inventory/ItemsWindow.tsx`, `SpellsWindow.tsx`, `narrow.ts` |

## Игра игрока (`vtt/src/game/player/`)

Экраны `D&D VTT / game / player`; собраны из компонентов выше. Вход — `#/join/<код>`.

| Что | Где |
|---|---|
| Экран листа при первом входе: TopPanel («Создать лист», «Повысить уровень: N», «Очистить», «Начать игру»; справа импорт, экспорт, печать) и лист | `game/player/PlayerGame.tsx` |
| Поле: карта-заглушка, слева Plate с пятью GameMenuButton, справа Plate с фишкой, фишкой спутника (временная иконка — буква в кружке), карандашом и ластиком | `game/player/PlayerField.tsx`, `stubMap.ts` |
| Окно костей у кнопки (количество, вид кости, «Бросить», результат) и лог бросков 240×130 в правом нижнем углу | `game/player/Dice.tsx` |
| Окна листа, спутника и инвентарей на оверлее с TopPanel: «Повысить уровень», «Отдых» (меню короткий / долгий), «Создать спутника», файлы листа (`SheetFiles`); на телефоне — меню «Ещё» (`MoreMenu`, IconButton `more.three.dots` + Popover) и «Закрыть» | `game/player/SeatWindow.tsx` |
| Визарды листа для экрана и окон: создание, уровень, спутник, его уровень | `game/player/useSeatWizards.tsx` |

## Игра мастера (`vtt/src/game/master/`)

Экраны `D&D VTT / game / master` (44:1629, 44:2135, 45:5549, 46:10178); собраны из компонентов выше. Адрес — `#/c/<id>/play`.

| Что | Где |
|---|---|
| Верхняя панель: ProjectMenu (сохранить, экспорт и импорт состояния игры, выйти), кнопки игроков — Button `light-accent`, у открытой фон `flow/*` игрока (45:5553); под ней Plate из четырёх GameMenuButton в цвете игрока (45:5608); «Отдых» — Button `primary` с Popover | `game/master/MasterGame.tsx` |
| Левая панель: RowTabs «Карты / NPC», SearchInput, строки карт RowCard с «…» и значком активной карты; NPC — RowSwitch «Показать каталог» и NpcCard `list` для перетаскивания | `game/master/MasterMaps.tsx` |
| Поле: MapView, полоса предпросмотра и сообщений, кластер в левом нижнем углу — Plate `left+bottom` с GameMenuButton костей (`grey`) и IconButton `switch` фишек игроков (`character.figure.avatar` в их цветах) и спутников (временная буква); окно костей над кластером | `game/master/MasterField.tsx` |
| Правая панель (57:3450): туман (button-chat, Slider, ластик), рисование (две button-chat: `character.pencil` серым, `character.eraser`), условия RowSwitch, лог 240×128 внизу (LogList) | `game/master/MasterTools.tsx` |

## Визарды (`vtt/src/wizard/`)

Не в макете — собраны из компонентов библиотеки. Демо — http://127.0.0.1:5176/#sheet.

| Что | Где |
|---|---|
| WizardFrame — окно визарда: GameWindow (шаг слева, «Описание» 300 px справа), точки шагов, WizardFooter («Начать заново», «Отменить», «Повторить», «Назад», главная кнопка) | `wizard/Frame.tsx`, `Wizard.module.css` |
| Pick (один вариант: поле с поиском и список Menu, группы, подсказки, стрелки и Enter), PickMany (несколько: чипы в рамке поля), Fixed, FeatureList, TextField, AreaField | `wizard/fields.tsx`, `fields.module.css` |
| Панель описаний (DescribeProvider, DescriptionPanel): карточки класса, подкласса, предыстории, вида, черты, заклинания, предмета, спутника и др. на Card инвентарей | `wizard/describe.tsx` |
| Визарды: создание персонажа, «Новый уровень», спутник | `wizard/character/`, `wizard/levelup/`, `wizard/companion/` |

## Ещё не сделано

- Канвас карты в экранах. Прототип уже есть: модуль `vtt/src/map` (сетка, стены, двери, туман, фишки, карандаш), страница http://127.0.0.1:5176/#map.

## Строки интерфейса

Все тексты интерфейса (не то, что вводят игроки, и не база правил) — в каталоге `vtt/src/i18n/`:

- `ru.ts` — русский каталог, сгруппирован по экранам описания: `common`, `coins`, `home`, `campaignMenu`, `editor` (`maps`, `npc`, `players`, `settings`), `player`, `sheet`, `companion`, `rest`, `inventory`, `spells`, `dice`, `master`, `wizard`. Тексты с числами — функции: `s.sheet.levelUp(3)` → «Повысить уровень: 3».
- `index.ts` — текущий язык (одна настройка, хранится в `localStorage` `vtt-language`), `useStrings()` для компонентов, `strings()` вне React, `setLanguage()`.
- Новый язык: файл той же формы `export const en: Catalog = { … }` и строка в `LANGUAGES`; TypeScript проверит, что не пропущено ни одной строки.
- Компоненты библиотеки пока держат свои тексты по умолчанию («Поиск», «Закрыть», «Скопировать код», названия монет); они уже есть в каталоге (`common`, `coins`) — при сборке экранов передавать их из `useStrings()`.
