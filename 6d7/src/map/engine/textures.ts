import { ImageSource, Texture } from 'pixi.js'
import type { Token } from '../core/types'

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

let catalogUrl: (tokenId: string) => string | undefined = () => undefined

/**
 * Where the pictures of the NPC catalog are: a catalog NPC is kept by the id of its token, not by
 * an address — the address differs between the dev server and the site, and a campaign moves
 * between them in an archive.
 */
export function resolveCatalog(url: (tokenId: string) => string | undefined) {
  catalogUrl = url
}

/** The picture of a token: a catalog NPC's by its id (an address saved with it earlier is ignored), else `image`. */
export function tokenImage(t: Pick<Token, 'image' | 'token'>): string | undefined {
  return (t.token && catalogUrl(t.token)) || t.image
}

function fetchImage(src: string): Promise<Blob> {
  for (const [prefix, load] of resolvers) {
    if (src.startsWith(prefix)) return load(src).then((b) => b ?? Promise.reject(new Error(`no picture ${src}`)))
  }
  return fetch(src).then((r) => (r.ok ? r.blob() : Promise.reject(new Error(`no picture ${src}: ${r.status}`))))
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
