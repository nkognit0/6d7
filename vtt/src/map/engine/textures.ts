import { ImageSource, Texture } from 'pixi.js'

const mipmapped = (resource: ImageBitmap | HTMLImageElement) =>
  new Texture({ source: new ImageSource({ resource, autoGenerateMipmaps: true, scaleMode: 'linear', mipmapFilter: 'linear' }) })

/** A one-color icon of the library (`currentColor`) rasterized at `px` in the given CSS color. */
export async function svgTexture(svg: string, color: string, px: number): Promise<Texture> {
  const src = svg.replace(/currentColor/g, color).replace(/width="\d+" height="\d+"/, `width="${px}" height="${px}"`)
  const img = new Image(px, px)
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(src)}`
  await img.decode()
  return mipmapped(img)
}

const cache = new Map<string, Promise<Texture>>()

/** A picture by URL (portraits, NPC tokens), mipmapped so small tokens do not flicker. */
export function loadTexture(url: string): Promise<Texture> {
  let t = cache.get(url)
  if (!t) {
    t = fetch(url)
      .then((r) => r.blob())
      .then((b) => createImageBitmap(b))
      .then(mipmapped)
    cache.set(url, t)
  }
  return t
}
