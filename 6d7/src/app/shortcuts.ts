// Keyboard shortcuts: one table of commands and their keys, one keyboard handler for the whole
// app. A screen says which commands it handles now; menus take the key hint from the same table.
// The full system of shortcuts will be designed later — it goes into COMMANDS.
import { useEffect, useRef } from 'react'

/** Where a command works. */
export type ShortcutScope = 'editor' | 'game'

export const COMMANDS = {
  undo: { keys: 'Mod+Z', scopes: ['editor'] },
  redo: { keys: 'Mod+Shift+Z', scopes: ['editor'] },
  /** removes what is chosen (an NPC on the map; a token in the game) */
  remove: { keys: 'Delete', scopes: ['editor', 'game'] }
} satisfies Record<string, { keys: string; scopes: ShortcutScope[] }>

export type CommandId = keyof typeof COMMANDS

const MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)

interface Keys {
  mod: boolean
  shift: boolean
  alt: boolean
  /** KeyboardEvent.code: the place of the key, the same in every layout (Z is «Я» in Russian) */
  code: string
  label: string
}

function parse(keys: string): Keys {
  const parts = keys.split('+')
  const key = parts[parts.length - 1]
  return {
    mod: parts.includes('Mod'),
    shift: parts.includes('Shift'),
    alt: parts.includes('Alt'),
    code: /^[A-Z]$/.test(key) ? `Key${key}` : /^\d$/.test(key) ? `Digit${key}` : key,
    label: key
  }
}

/** The hint of a menu item: «Ctrl+Shift+Z» (on a Mac «⇧⌘Z»). */
export function shortcutLabel(id: CommandId): string {
  const k = parse(COMMANDS[id].keys)
  if (MAC) return `${k.alt ? '⌥' : ''}${k.shift ? '⇧' : ''}${k.mod ? '⌘' : ''}${k.label}`
  return [k.mod && 'Ctrl', k.alt && 'Alt', k.shift && 'Shift', k.label].filter(Boolean).join('+')
}

function pressed(e: KeyboardEvent, k: Keys): boolean {
  const mod = MAC ? e.metaKey : e.ctrlKey
  return e.code === k.code && mod === k.mod && e.shiftKey === k.shift && e.altKey === k.alt && (MAC ? !e.ctrlKey : !e.metaKey)
}

// a text field keeps its own keys (Ctrl+Z undoes the typing in it)
function typing(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)
}

type Handlers = Partial<Record<CommandId, () => void>>
const active: { scope: ShortcutScope; handlers: { current: Handlers } }[] = []

function onKey(e: KeyboardEvent) {
  if (e.repeat && !e.ctrlKey && !e.metaKey) return
  if (typing(e.target)) return
  // the screen mounted last (a window over the editor) gets the keys first
  for (let i = active.length - 1; i >= 0; i--) {
    const { scope, handlers } = active[i]
    for (const [id, cmd] of Object.entries(COMMANDS) as [CommandId, (typeof COMMANDS)[CommandId]][]) {
      const run = handlers.current[id]
      if (!run || !(cmd.scopes as ShortcutScope[]).includes(scope) || !pressed(e, parse(cmd.keys))) continue
      e.preventDefault()
      run()
      return
    }
  }
}

/** Handles commands while the component is on screen. */
export function useShortcuts(scope: ShortcutScope, handlers: Handlers) {
  const ref = useRef(handlers)
  ref.current = handlers
  useEffect(() => {
    const entry = { scope, handlers: ref }
    if (!active.length) addEventListener('keydown', onKey)
    active.push(entry)
    return () => {
      active.splice(active.indexOf(entry), 1)
      if (!active.length) removeEventListener('keydown', onKey)
    }
  }, [scope])
}
