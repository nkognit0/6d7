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
const resolvers = new Map<string, (src: string) => Promise<Blob | null>>()

/**
 * Pictures that are not URLs: tokens may point to the app's files (`media:<hash>` of the media
 * store); the app tells the map how to get them.
 */
export function resolveImages(prefix: string, load: (src: string) => Promise<Blob | null>) {
  resolvers.set(prefix, load)
}

function fetchImage(src: string): Promise<Blob> {
  for (const [prefix, load] of resolvers) {
    if (src.startsWith(prefix)) return load(src).then((b) => b ?? Promise.reject(new Error(`no picture ${src}`)))
  }
  return fetch(src).then((r) => r.blob())
}

/** A picture by URL or a resolved reference (portraits, NPC tokens), mipmapped so small tokens do not flicker. */
export function loadTexture(url: string): Promise<Texture> {
  let t = cache.get(url)
  if (!t) {
    t = fetchImage(url)
      .then((b) => createImageBitmap(b))
      .then(mipmapped)
    cache.set(url, t)
  }
  return t
}
