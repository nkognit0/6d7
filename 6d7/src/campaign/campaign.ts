// Operations of the campaign document and their opposites («Отменить»), colors and codes of the
// players. Pure functions: the server will run the same code.
import { newId } from '../map/core/geometry'
import { applyOp } from '../map/core/scene'
import type { ExploredData } from '../map/core/explored'
import type { FlowColor, MapOp } from '../map/core/types'
import type { GameDoc, GameMap } from './game'
import type { Campaign, CampaignDocs, CampaignMeta, CampaignOp, CampaignSettings, Change, DocKey, PlayerSlot } from './types'

/** The order in which new players get their colors (Figma flow/*). */
export const FLOW_ORDER: FlowColor[] = ['red', 'orange', 'yellow', 'green', 'blue', 'indigo', 'purple', 'scarlett']

export const DEFAULT_SETTINGS: CampaignSettings = { freeMove: true, freeDoors: true, dynamicFog: false }

export function createCampaign(name: string, id = newId()): Campaign {
  return { schema: 1, id, name, settings: { ...DEFAULT_SETTINGS }, players: [], maps: [], npcs: [] }
}

/** The first color no player has yet; null when all eight are taken. */
export function freeColor(c: Campaign): FlowColor | null {
  const used = new Set(c.players.map((p) => p.color))
  return FLOW_ORDER.find((f) => !used.has(f)) ?? null
}

/** A new player with the next free color; null when the campaign already has eight. */
export function newPlayer(c: Campaign, name = ''): PlayerSlot | null {
  const color = freeColor(c)
  return color ? { id: newId(), name, color } : null
}

function insert<T>(list: T[], item: T, index?: number): T[] {
  const i = index === undefined ? list.length : Math.max(0, Math.min(index, list.length))
  return [...list.slice(0, i), item, ...list.slice(i)]
}

function move<T>(list: T[], from: number, to: number): T[] {
  if (from < 0 || from === to) return list
  const rest = list.filter((_, i) => i !== from)
  return insert(rest, list[from], to)
}

export function applyCampaignOp(c: Campaign, op: CampaignOp): Campaign {
  switch (op.type) {
    case 'rename':
      return { ...c, name: op.name }
    case 'settings':
      return { ...c, settings: { ...c.settings, ...op.patch } }
    case 'player.add':
      return c.players.some((p) => p.id === op.player.id) ? c : { ...c, players: insert(c.players, op.player, op.index) }
    case 'player.update':
      return { ...c, players: c.players.map((p) => (p.id === op.id ? { ...p, ...op.patch } : p)) }
    case 'player.remove':
      return { ...c, players: c.players.filter((p) => p.id !== op.id) }
    case 'map.add':
      return c.maps.includes(op.id) ? c : { ...c, maps: insert(c.maps, op.id, op.index) }
    case 'map.remove':
      return { ...c, maps: c.maps.filter((m) => m !== op.id) }
    case 'map.move':
      return { ...c, maps: move(c.maps, c.maps.indexOf(op.id), op.index) }
    case 'npc.put': {
      const i = c.npcs.findIndex((n) => n.id === op.npc.id)
      if (i < 0) return { ...c, npcs: insert(c.npcs, op.npc, op.index) }
      return { ...c, npcs: c.npcs.map((n) => (n.id === op.npc.id ? op.npc : n)) }
    }
    case 'npc.remove':
      return { ...c, npcs: c.npcs.filter((n) => n.id !== op.id) }
  }
}

/** The operations that take `op` back, computed on the campaign before it. */
export function invertCampaignOp(c: Campaign, op: CampaignOp): CampaignOp[] {
  switch (op.type) {
    case 'rename':
      return [{ type: 'rename', name: c.name }]
    case 'settings': {
      const patch: Partial<CampaignSettings> = {}
      for (const k of Object.keys(op.patch) as (keyof CampaignSettings)[]) patch[k] = c.settings[k]
      return [{ type: 'settings', patch }]
    }
    case 'player.add':
      return c.players.some((p) => p.id === op.player.id) ? [] : [{ type: 'player.remove', id: op.player.id }]
    case 'player.update': {
      const p = c.players.find((x) => x.id === op.id)
      if (!p) return []
      const patch: Partial<Omit<PlayerSlot, 'id'>> = {}
      for (const k of Object.keys(op.patch) as (keyof typeof patch)[]) (patch as Record<string, unknown>)[k] = p[k]
      return [{ type: 'player.update', id: p.id, patch }]
    }
    case 'player.remove': {
      const i = c.players.findIndex((p) => p.id === op.id)
      return i < 0 ? [] : [{ type: 'player.add', player: c.players[i], index: i }]
    }
    case 'map.add':
      return c.maps.includes(op.id) ? [] : [{ type: 'map.remove', id: op.id }]
    case 'map.remove': {
      const i = c.maps.indexOf(op.id)
      return i < 0 ? [] : [{ type: 'map.add', id: op.id, index: i }]
    }
    case 'map.move': {
      const i = c.maps.indexOf(op.id)
      return i < 0 ? [] : [{ type: 'map.move', id: op.id, index: i }]
    }
    case 'npc.put': {
      const i = c.npcs.findIndex((n) => n.id === op.npc.id)
      return i < 0 ? [{ type: 'npc.remove', id: op.npc.id }] : [{ type: 'npc.put', npc: c.npcs[i] }]
    }
    case 'npc.remove': {
      const i = c.npcs.findIndex((n) => n.id === op.id)
      return i < 0 ? [] : [{ type: 'npc.put', npc: c.npcs[i], index: i }]
    }
  }
}

/** Applies a saved change to a set of documents (replaying a journal outside an open session). */
export function applyChange(docs: CampaignDocs, ch: Change): CampaignDocs {
  if (ch.doc === 'campaign') {
    if ('op' in ch) return { ...docs, campaign: applyCampaignOp(docs.campaign, ch.op as CampaignOp) }
    if ('set' in ch) return { ...docs, campaign: ch.set as Campaign }
    return docs
  }
  const [kind, id] = splitKey(ch.doc)
  if (kind === 'map') {
    const maps = { ...docs.maps }
    if ('op' in ch) {
      if (maps[id]) maps[id] = applyOp(maps[id], ch.op)
    } else if ('set' in ch) maps[id] = ch.set as CampaignDocs['maps'][string]
    else delete maps[id]
    return { ...docs, maps }
  }
  if (kind === 'seat') {
    const seats = { ...docs.seats }
    if ('set' in ch) seats[id] = ch.set as CampaignDocs['seats'][string]
    else if ('drop' in ch) delete seats[id]
    return { ...docs, seats }
  }
  if (kind === 'game') return { ...docs, game: 'set' in ch ? (ch.set as GameDoc) : undefined }
  if (kind === 'game/map') {
    const gameMaps = { ...docs.gameMaps }
    if ('op' in ch) {
      const gm = gameMaps[id]
      if (gm) gameMaps[id] = { ...gm, scene: applyOp(gm.scene, ch.op as MapOp) }
    } else if ('set' in ch) gameMaps[id] = ch.set as GameMap
    else delete gameMaps[id]
    return { ...docs, gameMaps }
  }
  if (kind === 'game/explored') {
    const explored = { ...docs.explored }
    if ('set' in ch) explored[id] = ch.set as ExploredData
    else delete explored[id]
    return { ...docs, explored }
  }
  return docs
}

/** Every document of a campaign by its key: what a snapshot and an import write. */
export function docEntries(docs: CampaignDocs): [DocKey, unknown][] {
  const out: [DocKey, unknown][] = [['campaign', docs.campaign]]
  for (const [id, scene] of Object.entries(docs.maps)) out.push([`map/${id}`, scene])
  for (const [id, seat] of Object.entries(docs.seats)) out.push([`seat/${id}`, seat])
  if (docs.game) out.push(['game', docs.game])
  for (const [id, gm] of Object.entries(docs.gameMaps ?? {})) out.push([`game/map/${id}`, gm])
  for (const [id, ex] of Object.entries(docs.explored ?? {})) out.push([`game/explored/${id}`, ex])
  return out
}

/** «Новая кампания», «Новая кампания 2»… — the first name not taken yet. */
export function freeName(base: string, taken: string[]): string {
  const names = new Set(taken)
  if (!names.has(base)) return base
  for (let n = 2; ; n++) if (!names.has(`${base} ${n}`)) return `${base} ${n}`
}

/** The home screen summary of a set of documents. */
export function metaOf(docs: CampaignDocs, updated: number): CampaignMeta {
  const first = docs.campaign.maps.map((id) => docs.maps[id]).find(Boolean)
  return {
    id: docs.campaign.id,
    name: docs.campaign.name,
    players: docs.campaign.players,
    preview: first?.image?.preview ?? null,
    images: Object.values(docs.maps).map((m) => m.image?.id).filter((x): x is string => !!x),
    updated
  }
}

/** `map/<id>` → ['map', id]; `campaign` → ['campaign', '']. */
export function splitKey(key: string): [string, string] {
  if (key.startsWith('game/map/')) return ['game/map', key.slice(9)]
  if (key.startsWith('game/explored/')) return ['game/explored', key.slice(14)]
  const i = key.indexOf('/')
  return i < 0 ? [key, ''] : [key.slice(0, i), key.slice(i + 1)]
}

// codes without letters and digits that look alike (0/O, 1/I/L)
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
export const CODE_LENGTH = 6

/**
 * A code of a player's place. Until the server gives real invitations it is a stub: unique in
 * this browser, it opens the player's game here.
 */
export function newCode(taken: (code: string) => boolean): string {
  for (;;) {
    const bytes = crypto.getRandomValues(new Uint8Array(CODE_LENGTH))
    const code = [...bytes].map((b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('')
    if (!taken(code)) return code
  }
}

/** What the user types: spaces and dashes out, letters up. */
export function normalizeCode(text: string): string {
  return text.toUpperCase().replace(/[\s-]/g, '')
}
