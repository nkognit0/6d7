import { Container, Graphics, Sprite, Text } from 'pixi.js'
import { cellPx, pinToImage } from '../core/geometry'
import type { GridSettings, Token, Vec } from '../core/types'
import type { MapTheme } from './theme'
import { loadTexture } from './textures'

// a token takes its whole cell; the player's ring is 1/16 of a cell (8 px at 100%)
const RING = 1 / 16
const SELECT = 1 / 32

interface View {
  key: string
  root: Container
}

/**
 * Tokens: NPCs go under the fog, players above it (players always see their own tokens).
 * A player token is the portrait in a thick ring of the player's color; without a portrait —
 * the first letter of the name.
 */
export class TokenLayer {
  readonly npc = new Container()
  readonly players = new Container()
  private views = new Map<string, View>()
  private ghost: View | null = null

  constructor(private onImage: () => void) {}

  sync(tokens: Token[], grid: GridSettings, theme: MapTheme, selected: string | null, hidden: (t: Token) => boolean) {
    const c = cellPx(grid)
    const seen = new Set<string>()
    for (const t of tokens) {
      seen.add(t.id)
      const key = `${t.name}|${t.image}|${t.color}|${t.kind}|${c}|${selected === t.id}`
      let v = this.views.get(t.id)
      if (!v || v.key !== key) {
        if (v) v.root.destroy({ children: true })
        v = { key, root: this.build(t, c, theme, selected === t.id) }
        this.views.set(t.id, v)
        ;(t.kind === 'player' ? this.players : this.npc).addChild(v.root)
      }
      const p = pinToImage(t.pin, grid)
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
      const at = pinToImage(token.pin, grid)
      v.root.position.set(at.x, at.y)
    }
  }

  /** A token dragged in from the panel, before it is on the map. */
  setGhost(token: Omit<Token, 'pin'> | null, p: Vec | null, grid: GridSettings, theme: MapTheme) {
    const c = cellPx(grid)
    const key = token ? `${token.name}|${token.image}|${token.color}|${c}` : ''
    if (this.ghost && (!token || this.ghost.key !== key)) {
      this.ghost.root.destroy({ children: true })
      this.ghost = null
    }
    if (!token || !p) return
    if (!this.ghost) {
      this.ghost = { key, root: this.build({ ...token, pin: { space: 'image', x: 0, y: 0 } }, c, theme, true) }
      this.ghost.root.alpha = 0.7
      this.players.addChild(this.ghost.root)
    }
    this.ghost.root.position.set(p.x, p.y)
  }

  private build(t: Token, c: number, theme: MapTheme, selected: boolean): Container {
    const root = new Container()
    const r = c / 2
    const ring = t.kind === 'player' && t.color ? theme.flow[t.color] : null
    const base = new Graphics().circle(0, 0, r).fill({ color: theme.tokenFill.color, alpha: theme.tokenFill.alpha })
    root.addChild(base)

    if (t.image) {
      const inner = ring ? r - c * RING : r
      loadTexture(t.image).then((tex) => {
        if (root.destroyed) return
        const sprite = new Sprite(tex)
        sprite.anchor.set(0.5)
        sprite.width = sprite.height = inner * 2
        if (ring) {
          const mask = new Graphics().circle(0, 0, inner).fill(0xffffff)
          root.addChild(mask)
          sprite.mask = mask
        }
        root.addChildAt(sprite, 1)
        this.onImage()
      })
    } else {
      const letter = new Text({
        text: (t.name.trim()[0] ?? '?').toUpperCase(),
        style: { fontFamily: 'Inter, sans-serif', fontWeight: '600', fontSize: c * 0.42, fill: theme.tokenText.color },
        resolution: 2
      })
      letter.anchor.set(0.5)
      letter.alpha = theme.tokenText.alpha
      root.addChild(letter)
    }
    const top = new Graphics()
    if (ring) top.circle(0, 0, r - (c * RING) / 2).stroke({ width: c * RING, color: ring.color, alpha: ring.alpha })
    if (selected) top.circle(0, 0, r + (c * SELECT) / 2).stroke({ width: c * SELECT, color: theme.selection.color, alpha: theme.selection.alpha })
    root.addChild(top)
    return root
  }

  destroy() {
    this.npc.destroy({ children: true })
    this.players.destroy({ children: true })
  }
}
