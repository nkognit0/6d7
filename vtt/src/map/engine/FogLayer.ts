import { BlurFilter, Container, Graphics, RenderTexture, Sprite, Texture, type Renderer } from 'pixi.js'
import type { FogShape, FogStroke, MapImageInfo } from '../core/types'
import type { Paint } from './theme'

/**
 * Fog of war as masks on the GPU, in a lower resolution than the picture:
 * - `fog`: the master's brush strokes;
 * - `explored`: everything players have seen (static fog only);
 * - the players' current view is cut out of both, then a blur gives soft edges.
 * The result is redrawn only when something changes; moving the camera costs nothing.
 * The masks are one cell bigger than the picture on every side, so the blur never thins the
 * fog at the map edge.
 */
export class FogLayer {
  readonly sprite = new Sprite()
  private rect = { x: 0, y: 0, w: 0, h: 0 }
  private s = 1
  private fogRT: RenderTexture | null = null
  private exploredRT: RenderTexture | null = null
  private composeRT: RenderTexture | null = null
  private softRT: RenderTexture | null = null
  private drawn: FogStroke[] = []
  private empty = new Container()

  private brushRoot = new Container()
  private brush = new Graphics()
  private exploredRoot = new Container()
  private exploredPolys = new Graphics()
  private composeRoot = new Container()
  private fogSprite = new Sprite()
  private exploredSprite = new Sprite()
  private polys = new Graphics()
  private blurRoot = new Container()
  private blurSprite = new Sprite()
  private blur = new BlurFilter({ strength: 8, quality: 3 })

  constructor(private maxMask: number) {
    this.brushRoot.addChild(this.brush)
    this.exploredRoot.addChild(this.exploredPolys)
    this.exploredSprite.blendMode = 'erase'
    this.polys.blendMode = 'erase'
    this.composeRoot.addChild(this.fogSprite, this.exploredSprite, this.polys)
    this.blurSprite.filters = [this.blur]
    this.blurRoot.addChild(this.blurSprite)
    this.sprite.visible = false
  }

  // the sprites let go of the masks before they are destroyed
  private release() {
    for (const s of [this.sprite, this.fogSprite, this.exploredSprite, this.blurSprite]) s.texture = Texture.EMPTY
    for (const rt of [this.fogRT, this.exploredRT, this.composeRT, this.softRT]) rt?.destroy(true)
    this.fogRT = this.exploredRT = this.composeRT = this.softRT = null
  }

  /** New picture: masks sized to it. */
  setup(renderer: Renderer, image: MapImageInfo | null, cell: number) {
    this.release()
    this.drawn = []
    this.sprite.visible = false
    if (!image) return
    const m = cell
    this.rect = { x: -m, y: -m, w: image.width + 2 * m, h: image.height + 2 * m }
    this.s = Math.min(1, this.maxMask / Math.max(this.rect.w, this.rect.h))
    const w = Math.ceil(this.rect.w * this.s)
    const h = Math.ceil(this.rect.h * this.s)
    const make = () => RenderTexture.create({ width: w, height: h, resolution: 1, scaleMode: 'linear' })
    this.fogRT = make()
    this.exploredRT = make()
    this.composeRT = make()
    this.softRT = make()
    this.fogSprite.texture = this.fogRT
    this.exploredSprite.texture = this.exploredRT
    this.blurSprite.texture = this.composeRT
    this.sprite.texture = this.softRT
    this.sprite.position.set(this.rect.x, this.rect.y)
    this.sprite.scale.set(1 / this.s)
    // world → mask pixels
    for (const g of [this.brush, this.exploredPolys, this.polys]) {
      g.scale.set(this.s)
      g.position.set(-this.rect.x * this.s, -this.rect.y * this.s)
    }
    this.blur.strength = Math.max(2, (cell * this.s) / 4)
    for (const rt of [this.fogRT, this.exploredRT, this.composeRT, this.softRT]) this.clearRT(renderer, rt)
  }

  get ready() {
    return !!this.fogRT
  }

  private clearRT(renderer: Renderer, target: RenderTexture) {
    renderer.render({ container: this.empty, target, clear: true, clearColor: [0, 0, 0, 0] })
  }

  /** Brings the brush mask up to the strokes of the scene; replays all only when history changed. */
  syncStrokes(renderer: Renderer, strokes: FogStroke[], force = false) {
    if (!this.fogRT) return
    const prefix = !force && this.drawn.length <= strokes.length && this.drawn.every((s, i) => s === strokes[i])
    if (!prefix) {
      this.clearRT(renderer, this.fogRT)
      this.drawn = []
    }
    for (const s of strokes.slice(this.drawn.length)) this.stroke(renderer, s)
    this.drawn = strokes.slice()
  }

  /** One stroke into the brush mask; new fog also hides what players had already explored. */
  stroke(renderer: Renderer, s: FogShape) {
    if (!this.fogRT || !this.exploredRT) return
    const g = this.brush
    g.clear()
    if (s.mode === 'cover') {
      g.rect(this.rect.x, this.rect.y, this.rect.w, this.rect.h).fill(0xffffff)
      g.blendMode = 'normal'
      renderer.render({ container: this.brushRoot, target: this.fogRT, clear: false })
      this.clearRT(renderer, this.exploredRT)
      return
    }
    const p = s.points
    if (p.length === 2) g.circle(p[0], p[1], s.radius).fill(0xffffff)
    else {
      g.moveTo(p[0], p[1])
      for (let i = 2; i < p.length; i += 2) g.lineTo(p[i], p[i + 1])
      g.stroke({ width: s.radius * 2, color: 0xffffff, cap: 'round', join: 'round' })
    }
    g.blendMode = s.mode === 'erase' ? 'erase' : 'normal'
    renderer.render({ container: this.brushRoot, target: this.fogRT, clear: false })
    if (s.mode === 'paint') {
      g.blendMode = 'erase'
      renderer.render({ container: this.brushRoot, target: this.exploredRT, clear: false })
    }
  }

  /** What players see now is cut out of the fog; with static fog it is also remembered. */
  compose(renderer: Renderer, visible: number[][], dynamic: boolean) {
    if (!this.composeRT || !this.softRT || !this.exploredRT) return
    if (!dynamic && visible.length) {
      this.exploredPolys.clear()
      for (const poly of visible) this.exploredPolys.poly(poly).fill(0xffffff)
      renderer.render({ container: this.exploredRoot, target: this.exploredRT, clear: false })
    }
    this.polys.clear()
    for (const poly of visible) this.polys.poly(poly).fill(0xffffff)
    this.exploredSprite.visible = !dynamic
    renderer.render({ container: this.composeRoot, target: this.composeRT, clear: true, clearColor: [0, 0, 0, 0] })
    renderer.render({ container: this.blurRoot, target: this.softRT, clear: true, clearColor: [0, 0, 0, 0] })
  }

  resetExplored(renderer: Renderer) {
    if (this.exploredRT) this.clearRT(renderer, this.exploredRT)
  }

  style(paint: Paint, alpha: number, visible: boolean) {
    this.sprite.tint = paint.color
    this.sprite.alpha = paint.alpha * alpha
    this.sprite.visible = visible && !!this.softRT
  }

  destroy() {
    this.release()
    for (const c of [this.brushRoot, this.exploredRoot, this.composeRoot, this.blurRoot]) c.destroy({ children: true })
    this.blur.destroy()
    this.sprite.destroy()
  }
}
