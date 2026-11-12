import { useCallback, useState, type ReactNode } from 'react'
import { Icon, type PlayerColor } from '../../icons/Icon'
import { cx, stateAttr, type PreviewState } from '../../lib'
import { Avatar } from '../Avatar/Avatar'
import { Menu, Popover } from '../Menu/Menu'
import styles from './MenuButton.module.css'

type MenuButtonBase = {
  /** menu items (MenuItem, MenuDivider); a click on an item closes the menu */
  children: ReactNode
  disabled?: boolean
  align?: 'start' | 'end'
  className?: string
  previewState?: PreviewState
}

function useOpen() {
  const [open, setOpen] = useState(false)
  const close = useCallback(() => setOpen(false), [])
  return { open, toggle: () => setOpen((o) => !o), close }
}

/** Figma: Dropdowns & menus / project-menu (26:749): campaign name with its menu. */
export function ProjectMenu({ title, children, disabled, align = 'start', className, previewState }: MenuButtonBase & { title: string }) {
  const { open, toggle, close } = useOpen()
  return (
    <div className={cx(styles.anchor, className)}>
      <button
        type="button"
        className={styles.project}
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={toggle}
        {...stateAttr(open ? 'active' : previewState)}
      >
        <span className={styles.projectTitle}>{title}</span>
        <span className={cx(styles.chevron, (open || previewState === 'active') && styles.up)}>
          <Icon name="chevron.down" />
        </span>
      </button>
      <Popover open={open} onClose={close} align={align}>
        <Menu>
          <div className={styles.items} onClick={close}>{children}</div>
        </Menu>
      </Popover>
    </div>
  )
}

/** Figma: Dropdowns & menus / user-menu (26:743): avatar, optional name and the user's menu. */
export function UserMenu({ name, color = 'orange', avatarSrc, showName = true, children, disabled, align = 'start', className, previewState }: Omit<MenuButtonBase, 'children'> & {
  /** menu items; without them a click does nothing (the editor: options will come later) */
  children?: ReactNode
  name: string
  color?: Exclude<PlayerColor, 'grey'>
  avatarSrc?: string
  showName?: boolean
}) {
  const { open, toggle, close } = useOpen()
  return (
    <div className={cx(styles.anchor, className)}>
      <button
        type="button"
        className={styles.user}
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={showName ? undefined : name}
        onClick={children ? toggle : undefined}
        {...stateAttr(open ? 'active' : previewState)}
      >
        <Avatar name={name} color={color} src={avatarSrc} className={styles.avatar} />
        {showName && <span className={styles.userName}>{name}</span>}
        <span className={cx(styles.userChevron, (open || previewState === 'active') && styles.up)}>
          <Icon name="chevron.down" />
        </span>
      </button>
      <Popover open={open} onClose={close} align={align}>
        <Menu>
          <div className={styles.items} onClick={close}>{children}</div>
        </Menu>
      </Popover>
    </div>
  )
}
