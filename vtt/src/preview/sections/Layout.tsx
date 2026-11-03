import { useState } from 'react'
import {
  BottomNavigation, Button, ConfirmDialog, Icon, Icon28, IconButton, MenuDivider, MenuItem, NavPage, NavTab, ProjectMenu, RowCard, RowField,
  RowSubtitle, RowSwitch, RowTabs, RowTitle, ScrollArea, SearchInput, Select, SidebarSection, SidebarTitle, Textarea, TextInput, TopPanel, UserMenu
} from '../../ui'
import { Cell, Row, Section } from '../kit'

const PAGES = [['map', 'Карты'], ['autointent', 'NPC'], ['person.human.avatar', 'Игроки'], ['settings', 'Параметры']] as const
const MAPS = ['Название локации 1', 'Название локации 2', 'Название локации 3', 'Название локации 4']

export function Layout() {
  const [page, setPage] = useState<string>('Карты')
  const [tab, setTab] = useState('Каталог')
  const [map, setMap] = useState(MAPS[0])
  const [grid, setGrid] = useState(true)
  const [size, setSize] = useState<'1' | '2'>('1')
  const [asking, setAsking] = useState(false)
  const [answer, setAnswer] = useState('—')
  return (
    <>
      <Section id="textarea" title="Textarea" figma="Input fields / text-input-multiline (7:1113)" note="Описание NPC и другие многострочные поля.">
        <Row label="состояния">
          <Cell caption="обычное" width={240}><Textarea defaultValue="Обычный" /></Cell>
          <Cell caption="фокус" width={240}><Textarea defaultValue="Обычный" previewState="focus" /></Cell>
          <Cell caption="пустое" width={240}><Textarea placeholder="Описание…" /></Cell>
          <Cell caption="неактивное" width={240}><Textarea defaultValue="Обычный" disabled /></Cell>
        </Row>
      </Section>

      <Section id="menu-buttons" title="ProjectMenu, UserMenu" figma="Dropdowns & menus / project-menu (26:749), user-menu (26:743)" note="Меню кампании и пользователя. Нажмите на живые примеры — откроется меню.">
        <Row label="project-menu">
          <Cell caption="обычное"><ProjectMenu title="<Название кампании>"><MenuItem>Сохранить</MenuItem></ProjectMenu></Cell>
          <Cell caption="наведение"><ProjectMenu title="<Название кампании>" previewState="hover"><MenuItem>Сохранить</MenuItem></ProjectMenu></Cell>
          <Cell caption="открыто"><ProjectMenu title="<Название кампании>" previewState="active"><MenuItem>Сохранить</MenuItem></ProjectMenu></Cell>
          <Cell caption="неактивное"><ProjectMenu title="<Название кампании>" disabled><MenuItem>Сохранить</MenuItem></ProjectMenu></Cell>
        </Row>
        <Row label="user-menu">
          <Cell caption="с именем"><UserMenu name="Имя пользователя"><MenuItem>Выйти</MenuItem></UserMenu></Cell>
          <Cell caption="наведение"><UserMenu name="Имя пользователя" previewState="hover"><MenuItem>Выйти</MenuItem></UserMenu></Cell>
          <Cell caption="открыто"><UserMenu name="Имя пользователя" previewState="active"><MenuItem>Выйти</MenuItem></UserMenu></Cell>
          <Cell caption="без имени (редактор)"><UserMenu name="Иван" showName={false}><MenuItem>Выйти</MenuItem></UserMenu></Cell>
          <Cell caption="неактивное"><UserMenu name="Имя пользователя" disabled><MenuItem>Выйти</MenuItem></UserMenu></Cell>
        </Row>
        <Row label="живой пример">
          <Cell caption="меню кампании">
            <ProjectMenu title="Подземелья Аболета">
              <MenuItem>Сохранить</MenuItem>
              <MenuItem>Экспортировать</MenuItem>
              <MenuDivider />
              <MenuItem icon={<Icon name="home" />}>На главный экран</MenuItem>
            </ProjectMenu>
          </Cell>
        </Row>
      </Section>

      <Section id="nav" title="NavTab, NavPage" figma="Navigation / nav-tab (27:1960), nav-page (27:1948)">
        <Row label="nav-tab">
          <Cell caption="обычное"><NavTab>Каталог</NavTab></Cell>
          <Cell caption="наведение"><NavTab previewState="hover">Каталог</NavTab></Cell>
          <Cell caption="выбрана"><NavTab selected>Каталог</NavTab></Cell>
          <Cell caption="фокус"><NavTab previewState="focus">Каталог</NavTab></Cell>
          <Cell caption="с индикатором"><NavTab indicator>Сохраненные</NavTab></Cell>
          <Cell caption="неактивное"><NavTab disabled>Каталог</NavTab></Cell>
        </Row>
        <Row label="nav-page">
          <Cell caption="обычное"><NavPage icon={<Icon28 name="map" />}>Карты</NavPage></Cell>
          <Cell caption="наведение"><NavPage icon={<Icon28 name="map" />} previewState="hover">Карты</NavPage></Cell>
          <Cell caption="выбрана"><NavPage icon={<Icon28 name="map" />} selected>Карты</NavPage></Cell>
          <Cell caption="с индикатором"><NavPage icon={<Icon28 name="map" />} indicator>Карты</NavPage></Cell>
          <Cell caption="неактивное"><NavPage icon={<Icon28 name="map" />} disabled>Карты</NavPage></Cell>
        </Row>
      </Section>

      <Section id="bars" title="TopPanel, BottomNavigation" figma="Top panel (100:3404), Bottom navigation (100:3004)" note="Верхняя панель и навигация редактора; вкладки внизу переключаются.">
        <TopPanel
          left={<ProjectMenu title="<Название кампании>"><MenuItem>Сохранить</MenuItem></ProjectMenu>}
          right={
            <>
              <IconButton variant="switch" pressed label="Редактирование" icon={<Icon name="edit" />} />
              <IconButton variant="switch" label="Глазами игрока" icon={<Icon name="play" />} />
              <UserMenu name="Иван" showName={false} align="end"><MenuItem>Выйти</MenuItem></UserMenu>
            </>
          }
        />
        <BottomNavigation>
          {PAGES.map(([icon, name]) => (
            <NavPage key={name} icon={<Icon28 name={icon} />} selected={page === name} onClick={() => setPage(name)}>{name}</NavPage>
          ))}
        </BottomNavigation>
      </Section>

      <Section id="sidebar" title="Боковая панель" figma="Sidebar sections / section-title (887:4452), section-general (887:4304); rows" note="Секции, строки и списки боковых панелей редактора и игры мастера — собраны как левая и правая панели редактора карт.">
        <Row label="примеры">
          <div style={{ width: 240, background: 'var(--bg-primary)', boxShadow: 'inset 0 0 0 1px var(--outline-primary)', borderRadius: 8 }}>
            <SidebarTitle title="Карты">
              <div style={{ display: 'flex', gap: 8 }}>
                <SearchInput />
                <IconButton label="Новая карта" icon={<Icon name="plus" />} />
              </div>
            </SidebarTitle>
            <SidebarSection>
              {MAPS.map((m) => (
                <RowCard key={m} selected={map === m} onClick={() => setMap(m)}
                  actions={<IconButton label="Действия с картой" icon={<Icon name="more.three.dots" />} />}>{m}</RowCard>
              ))}
            </SidebarSection>
          </div>
          <div style={{ width: 240, background: 'var(--bg-primary)', boxShadow: 'inset 0 0 0 1px var(--outline-primary)', borderRadius: 8 }}>
            <SidebarSection>
              <RowTitle title="Редактирование" action={
                <span style={{ display: 'flex', alignItems: 'center' }}>
                  <IconButton label="Уменьшить" icon={<Icon name="minus" />} /><span>100%</span><IconButton label="Увеличить" icon={<Icon name="plus" />} />
                </span>
              } />
            </SidebarSection>
            <SidebarSection>
              <RowSwitch label="Сетка" checked={grid} onChange={setGrid} />
              <RowField label="Размер"><Select value={size} onChange={setSize} options={[{ value: '1', label: '1' }, { value: '2', label: '2' }]} /></RowField>
              <RowField label="Имя" layout="stacked"><TextInput defaultValue="Аболет" /></RowField>
            </SidebarSection>
            <SidebarSection>
              <RowSubtitle actions={<IconButton label="Добавить" icon={<Icon name="plus" />} />}>Объекты</RowSubtitle>
              <RowSubtitle tone="secondary">Подзаголовок secondary</RowSubtitle>
              <RowSubtitle inactive>Неактивный подзаголовок</RowSubtitle>
            </SidebarSection>
            <SidebarSection>
              <RowTabs stretch>
                {['Каталог', 'Сохраненные'].map((t) => (
                  <NavTab key={t} selected={tab === t} onClick={() => setTab(t)}>{t}</NavTab>
                ))}
              </RowTabs>
            </SidebarSection>
            <SidebarSection>
              <Button stretch>Сохранить</Button>
            </SidebarSection>
          </div>
        </Row>
        <Row label="row-card">
          <Cell caption="обычное" width={216}><RowCard>Название локации</RowCard></Cell>
          <Cell caption="наведение" width={216}><RowCard previewState="hover">Название локации</RowCard></Cell>
          <Cell caption="выбрана" width={216}><RowCard selected>Название локации</RowCard></Cell>
          <Cell caption="alert" width={216}><RowCard status="alert">Название локации</RowCard></Cell>
          <Cell caption="error" width={216}><RowCard status="error">Название локации</RowCard></Cell>
          <Cell caption="неактивное" width={216}><RowCard inactive>Название локации</RowCard></Cell>
        </Row>
      </Section>

      <Section id="scroll" title="ScrollArea" figma="Bars / scroll-bar (1:1382)" note="Полоса прокрутки библиотеки: 12 px, бегунок 6 px, при перетаскивании синий.">
        <Row label="пример">
          <ScrollArea style={{ width: 240, height: 160, boxShadow: 'inset 0 0 0 1px var(--outline-primary)', borderRadius: 8, padding: '8px 0 8px 12px' }}>
            {Array.from({ length: 20 }, (_, i) => (
              <div key={i} style={{ lineHeight: '28px' }}>Строка {i + 1}</div>
            ))}
          </ScrollArea>
        </Row>
      </Section>

      <Section id="confirm" title="ConfirmDialog" figma="нет в макете: окно modal/dice (34:7794) поверх оверлея (30:4208)" note="Вопрос перед тем, что нельзя отменить: удаление кампании. Фокус на «Отмена»; Escape и щелчок мимо окна — тоже отмена.">
        <Row label="живой пример">
          <Cell caption={`ответ: ${answer}`}>
            <Button variant="primary" onClick={() => setAsking(true)}>Удалить кампанию</Button>
            {asking && (
              <ConfirmDialog
                text="Вы уверены, что хотите удалить кампанию?"
                confirm="Удалить"
                cancel="Отмена"
                onConfirm={() => { setAnswer('удалить'); setAsking(false) }}
                onCancel={() => { setAnswer('отмена'); setAsking(false) }}
              />
            )}
          </Cell>
        </Row>
      </Section>
    </>
  )
}
