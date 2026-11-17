# 6d7

Виртуальный стол для D&D 2024 в браузере: кампании мастера с картами, туманом войны и NPC, листы персонажей и спутников, игра мастера и игроков. Игрок играет с телефона или планшета, мастер — с компьютера.

Сайт: https://nkognit0.github.io/6d7/

Сейчас это офлайн-версия: кампании хранятся в браузере (IndexedDB), а игра идёт между вкладками одного браузера — мастер в одной, игроки по коду в других. Сервер для игры по сети ещё впереди.

## Что в репозитории

| Папка | Что там |
|---|---|
| `6d7/` | Приложение: Vite, React 18, TypeScript, CSS Modules, карта на PixiJS 8 (WebGL2) |
| `docs/` | Описание приложения, решения по вопросам (`QnA.md`), модель данных, план, каталог компонентов, фичи на потом |
| `assets/` | Экспорт дизайна из Figma: токены цветов и иконки |
| `dnd-rules/` | Подмодуль: пакет правил D&D 2024 — логика, база, тип листа, иконки предметов и заклинаний |

Внутри `6d7/src`: `ui/` — библиотека компонентов, `campaign/` — кампании и их хранение, `map/` — карта (ядро без браузера в `map/core`), `game/` — листы, инвентари, игра мастера и игрока, `editor/` — редактор кампании, `home/` — главный экран, `wizard/` — визарды персонажа, уровня и спутника.

## Как запустить

Правила D&D — логика, база, тип листа и иконки — в пакете [dnd-rules](https://github.com/nkognit0/dnd-rules), он подключён подмодулем `dnd-rules/`. Клонировать вместе с ним (Node 20 или новее):

```bash
git clone --recursive https://github.com/nkognit0/6d7.git
cd 6d7/6d7
npm ci
npm run dev        # dev-сервер
npm test           # тесты (vitest)
npm run build      # сборка в 6d7/dist
```

Страницы для разработки: `#preview` — все компоненты, `#map` — прототип карты, `#sheet` — листы на демо-персонаже.

## Лицензия

Код 6d7 — [GNU AGPL 3.0 или более поздняя версия](LICENSE). Если вы запускаете изменённую версию как сервис, её исходный код нужно открыть пользователям.

Чужие материалы под своими лицензиями:

- Токены NPC в `6d7/public/tokens` — [Too Many Tokens - DnD](https://github.com/IsThisMyRealName/too-many-tokens-dnd), MIT, © 2023 Jonathan Held (см. `6d7/public/tokens/LICENSE`).
- Шрифты Inter и PT Serif Caption — SIL Open Font License (пакеты `@fontsource`).
- В пакете `dnd-rules` (см. его README): иконки предметов — [dnd-item-icons-by-gwill](https://github.com/Gwillewyn/dnd-item-icons-by-gwill) (CC BY 3.0), иконки заклинаний — Painterly Spell Icons, J. W. Bjerk (CC BY 3.0); тип листа из dnd-sheet — MIT.
- Правила D&D на сайте включают материал из System Reference Document 5.2.1 («SRD 5.2.1») от Wizards of the Coast LLC (https://www.dndbeyond.com/srd), лицензия Creative Commons Attribution 4.0 International (https://creativecommons.org/licenses/by/4.0/legalcode). Остальной контент правил — собственность правообладателей, лицензия AGPL на него не распространяется.

Dungeons & Dragons и D&D — товарные знаки Wizards of the Coast. 6d7 — фанатский проект, с Wizards of the Coast не связан.
