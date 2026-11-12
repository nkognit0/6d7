import { Container, ImageSource, Rectangle, Sprite, Texture } from 'pixi.js'
import type { MapImageInfo, TileProvider } from '../core/types'
import type { Camera } from './camera'

interface Tile {
  key: string
  level: number
  sprite: Sprite
  texture: Texture
  bitmap: ImageBitmap
  bytes: number
  used: number
}

/**
 * The picture as a tile pyramid. Only tiles of the visible area at the level that suits the
 * zoom are loaded; the smallest level stays loaded as a backdrop, so the map never shows holes
 * while sharper tiles arrive. Old tiles are dropped when the cache is over budget.
 */
export class TileLayer {
  readonly container = new Container({ sortableChildren: true })
  private image: MapImageInfo | null = null
  private tiles = new Map<string, Tile>()
  private loading = new Map<string, AbortController>()
  private frame = 0
  /** pyramid level drawn now */
  level = 0

  constructor(private provider: TileProvider, private onLoad: () => void, private budget: number) {}

  setImage(image: MapImageInfo | null) {
    if (image?.id === this.image?.id) return
    this.clear()
    this.image = image
  }

  get count() {
    return this.tiles.size
  }

  /** GPU memory of the loaded tiles, with mipmaps. */
  get bytes() {
    let sum = 0
    for (const t of this.tiles.values()) sum += t.bytes
    return sum
  }

  update(camera: Camera, viewW: number, viewH: number, dpr: number) {
    const img = this.image
    if (!img) return
    this.frame++
    const top = img.levels - 1
    // the coarsest level whose pixels are still not bigger than a screen pixel
    const level = Math.max(0, Math.min(top, Math.floor(Math.log2(1 / (camera.scale * dpr)))))
    this.level = level
    const a = camera.toWorld(0, 0)
    const b = camera.toWorld(viewW, viewH)

    const want = (l: number, request: boolean) => {
      const span = img.tileSize * 2 ** l
      const lw = Math.ceil(img.width / 2 ** l)
      const lh = Math.ceil(img.height / 2 ** l)
      const c1 = Math.max(0, Math.floor(a.x / span))
      const r1 = Math.max(0, Math.floor(a.y / span))
      const c2 = Math.min(Math.ceil(lw / img.tileSize) - 1, Math.floor(b.x / span))
      const r2 = Math.min(Math.ceil(lh / img.tileSize) - 1, Math.floor(b.y / span))
      for (let row = r1; row <= r2; row++) {
        for (let col = c1; col <= c2; col++) {
          const key = `${l}/${col}/${row}`
          const t = this.tiles.get(key)
          if (t) t.used = this.frame
          else if (request) this.request(img, l, col, row, key)
        }
      }
    }
    want(top, true)
    want(level, true)
    // coarser tiles already in memory fill the gaps until the sharp ones arrive
    for (let l = level + 1; l < top; l++) want(l, false)

    for (const [key, ctrl] of this.loading) {
      if (!key.startsWith(`${level}/`) && !key.startsWith(`${top}/`)) {
        ctrl.abort()
        this.loading.delete(key)
      }
    }
    for (const t of this.tiles.values()) t.sprite.visible = t.used === this.frame
    this.evict(top)
  }

  private request(img: MapImageInfo, level: number, col: number, row: number, key: string) {
    if (this.loading.has(key)) return
    const ctrl = new AbortController()
    this.loading.set(key, ctrl)
    this.provider.load(img, level, col, row, ctrl.signal).then(
      (bitmap) => {
        if (ctrl.signal.aborted || this.image !== img) {
          bitmap.close()
          return
        }
        this.loading.delete(key)
        this.add(img, level, col, row, key, bitmap)
        this.onLoad()
      },
      () => this.loading.delete(key)
    )
  }

  private add(img: MapImageInfo, level: number, col: number, row: number, key: string, bitmap: ImageBitmap) {
    const source = new ImageSource({ resource: bitmap, autoGenerateMipmaps: true, scaleMode: 'linear', mipmapFilter: 'linear' })
    // the file has 1 px of the neighbors around the tile: show only the inner square
    const texture = new Texture({ source, frame: new Rectangle(1, 1, bitmap.width - 2, bitmap.height - 2) })
    const sprite = new Sprite(texture)
    const k = 2 ** level
    sprite.position.set(col * img.tileSize * k, row * img.tileSize * k)
    sprite.scale.set(k)
    sprite.zIndex = -level
    this.container.addChild(sprite)
    this.tiles.set(key, { key, level, sprite, texture, bitmap, bytes: bitmap.width * bitmap.height * 4 * 1.34, used: this.frame })
  }

  private evict(top: number) {
    if (this.tiles.size <= this.budget) return
    const old = [...this.tiles.values()].filter((t) => t.level !== top && t.used !== this.frame).sort((p, q) => p.used - q.used)
    for (const t of old.slice(0, this.tiles.size - this.budget)) this.drop(t)
  }

  private drop(t: Tile) {
    this.tiles.delete(t.key)
    t.sprite.destroy()
    t.texture.destroy(true)
    t.bitmap.close()
  }

  clear() {
    for (const ctrl of this.loading.values()) ctrl.abort()
    this.loading.clear()
    for (const t of [...this.tiles.values()]) this.drop(t)
  }

  destroy() {
    this.clear()
    this.container.destroy()
  }
}
