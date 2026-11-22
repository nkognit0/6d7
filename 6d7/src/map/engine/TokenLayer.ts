import { Container, Graphics, Sprite, Text } from 'pixi.js'
import { cellPx } from '../core/geometry'
import { tokenCenter, tokenSize } from '../core/tokens'
import type { GridSettings, Token, Vec } from '../core/types'
import type { MapTheme } from './theme'
import { tokenImage } from './images'
import { loadTexture } from './textures'

// a token takes its cells (an NPC 1×1 to 4×4); the ring is 1/16 of a cell (8 px at 100%), the
// same on a big NPC
const RING = 1 / 16
const SELECT = 1 / 32
/** Below this zoom tokens are plain discs (the spawn point turns solid at the same zoom). */
export const TOKEN_COMPACT_PERCENT = 40

interface View {
  key: string
  root: Container
}

/**
 * Tokens: NPCs go under the fog, players above it (players always see their own tokens).
 * A player token is the portrait in a thick ring of the player's color, an NPC its picture in a
 * light grey ring (outline/primary); without a picture (or one that does not load) — the first
 * letter of the name. Zoomed out (`compact`) pictures melt into a many-colored map, so a token
 * becomes a plain disc: a player's of the player's color, an NPC's white in a black and a grey
 * ring (QnA, 22.11.2026).
 */
export class TokenLayer {
  readonly npc = new Container()
  readonly players = new Container()
  private views = new Map<string, View>()
  private ghost: View | null = null

  constructor(private onImage: () => void) {}

  sync(tokens: Token[], grid: GridSettings, theme: MapTheme, selected: string | null, hidden: (t: Token) => boolean, compact = false) {
    const c = cellPx(grid)
    const seen = new Set<string>()
    for (const t of tokens) {
      seen.add(t.id)
      const key = `${t.name}|${tokenImage(t)}|${t.color}|${t.kind}|${tokenSize(t)}|${c}|${selected === t.id}|${compact}`
      let v = this.views.get(t.id)
      if (!v || v.key !== key) {
        if (v) v.root.destroy({ children: true })
        v = { key, root: this.build(t, c, theme, selected === t.id, compact) }
        this.views.set(t.id, v)
        ;(t.kind === 'player' ? this.players : this.npc).addChild(v.root)
      }
      const p = tokenCenter(t, grid)
      v.root.position.set(p.x, p.y)
      v.root.visible = !hidden(t)
    }
    for (const [id, v] of this.views) {
      if (seen.has(id)) continue
      v.root.destroy({ children: true })
      this.views.delete(id)
    }
  }

  /** Moves a token while it is dragged (the scene changes only on drop). */
  preview(id: string, p: Vec | null, grid: GridSettings, token?: Token) {
    const v = this.views.get(id)
    if (v && p) v.root.position.set(p.x, p.y)
    else if (v && token) {
      const at = tokenCenter(token, grid)
      v.root.position.set(at.x, at.y)
    }
  }

  /** A token dragged in from the panel, before it is on the map. */
  setGhost(token: Omit<Token, 'pin'> | null, p: Vec | null, grid: GridSettings, theme: MapTheme) {
    const c = cellPx(grid)
    const key = token ? `${token.name}|${tokenImage(token)}|${token.color}|${tokenSize(token)}|${c}` : ''
    if (this.ghost && (!token || this.ghost.key !== key)) {
      this.ghost.root.destroy({ children: true })
      this.ghost = null
    }
    if (!token || !p) return
    if (!this.ghost) {
      this.ghost = { key, root: this.build({ ...token, pin: { space: 'image', x: 0, y: 0 } }, c, theme, true, false) }
      this.ghost.root.alpha = 0.7
      this.players.addChild(this.ghost.root)
    }
    this.ghost.root.position.set(p.x, p.y)
  }

  private build(t: Token, c: number, theme: MapTheme, selected: boolean, compact: boolean): Container {
    const root = new Container()
    const r = (c * tokenSize(t)) / 2
    const w = c * RING
    const player = t.kind === 'player' && t.color ? theme.flow[t.color] : null
    const ring = player ?? theme.tokenRing
    const top = new Graphics()
    const select = () => {
      if (selected) top.circle(0, 0, r + (c * SELECT) / 2).stroke({ width: c * SELECT, color: theme.selection.color, alpha: theme.selection.alpha })
    }

    if (compact) {
      select()
      const disc = new Graphics()
      if (player) disc.circle(0, 0, r).fill({ color: player.color, alpha: player.alpha })
      else {
        const fill = theme.tokenCompactFill
        const line = theme.tokenCompactLine
        disc.circle(0, 0, r).fill({ color: fill.color, alpha: fill.alpha })
        disc.circle(0, 0, r - w / 2).stroke({ width: w, color: ring.color, alpha: ring.alpha })
        disc.circle(0, 0, r - w * 1.5).stroke({ width: w, color: line.color, alpha: line.alpha })
      }
      root.addChild(disc, top)
      return root
    }

    const base = new Graphics().circle(0, 0, r).fill({ color: theme.tokenFill.color, alpha: theme.tokenFill.alpha })
    root.addChild(base)
    const letter = () => {
      const text = new Text({
        text: (t.name.trim()[0] ?? '?').toUpperCase(),
        style: { fontFamily: 'Inter, sans-serif', fontWeight: '600', fontSize: c * 0.42 * tokenSize(t), fill: theme.tokenText.color },
        resolution: 2
      })
      text.anchor.set(0.5)
      text.alpha = theme.tokenText.alpha
      return text
    }
    const image = tokenImage(t)
    const inner = r - w
    if (image) {
      loadTexture(image).then(
        (tex) => {
          if (root.destroyed) return
          const sprite = new Sprite(tex)
          sprite.anchor.set(0.5)
          sprite.width = sprite.height = inner * 2
          // a picture inside the ring is cut into a circle (the catalog's are round already)
          const mask = new Graphics().circle(0, 0, inner).fill(0xffffff)
          root.addChild(mask)
          sprite.mask = mask
          root.addChildAt(sprite, 1)
          this.onImage()
        },
        () => {
          if (root.destroyed) return
          root.addChildAt(letter(), 1)
          this.onImage()
        }
      )
    } else root.addChild(letter())
    top.circle(0, 0, r - w / 2).stroke({ width: w, color: ring.color, alpha: ring.alpha })
    select()
    root.addChild(top)
    return root
  }

  destroy() {
    this.npc.destroy({ children: true })
    this.players.destroy({ children: true })
  }
}
