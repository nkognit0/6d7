// Where the pictures of tokens come from. No renderer here: the app registers its sources at
// start (main.tsx) without loading the map's engine.
import type { Token } from '../core/types'

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

/**
 * The picture of a token: the app's own file (a portrait, an NPC's own avatar), else a catalog
 * NPC's by its id (an address of a catalog picture saved with it earlier is ignored), else `image`.
 */
export function tokenImage(t: Pick<Token, 'image' | 'token'>): string | undefined {
  if (t.image && [...resolvers.keys()].some((prefix) => t.image!.startsWith(prefix))) return t.image
  return (t.token && catalogUrl(t.token)) || t.image
}

/** The bytes of a picture: a resolved reference or a URL. */
export function fetchImage(src: string): Promise<Blob> {
  for (const [prefix, load] of resolvers) {
    if (src.startsWith(prefix)) return load(src).then((b) => b ?? Promise.reject(new Error(`no picture ${src}`)))
  }
  return fetch(src).then((r) => (r.ok ? r.blob() : Promise.reject(new Error(`no picture ${src}: ${r.status}`))))
}
