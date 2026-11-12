// The media store (docs/data-model.md): files addressed by the SHA-256 of their bytes
// («media:<hex>»). A file never changes, so a reference stays valid and the same picture is kept
// once. Until the server exists the files live in the browser's IndexedDB; without it (a private
// window) they live for the session in memory.
import { useEffect, useState } from 'react'
import { openDatabase, request, transactIn } from '../../campaign/local/idb'
import type { MediaRef } from '../seat/seat'

const DB = '6d7-media'
/** The name before the app was called 6d7: its files move over once. */
const FORMER_DB = 'vtt-media'
/** hash → Blob */
const FILES = 'files'
/** hash → when the collector first found nothing referring to the file, ms */
const ORPHANS = 'orphans'

/**
 * A file nothing refers to is deleted this long after it was first found so: a picture uploaded a
 * moment before its sheet is saved, or one an «Отменить» of an open editor brings back, is still
 * there.
 */
export const ORPHAN_MS = 24 * 60 * 60 * 1000

// the files of a session the browser gives no database (a private window)
const memory = new Map<string, Blob>()
let opened: Promise<IDBDatabase | null> | null = null

function db(): Promise<IDBDatabase | null> {
  opened ??= openDatabase(DB, 2, (d, from) => {
    if (from < 1) d.createObjectStore(FILES)
    if (from < 2) d.createObjectStore(ORPHANS)
  }, FORMER_DB).then(
    (d) => {
      d.onversionchange = () => {
        d.close()
        opened = null
      }
      return d
    },
    () => null
  )
  return opened
}

const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')

/**
 * Keeps a file; its reference. A write the browser refuses (the disk is full) throws: a reference
 * to nothing would break the picture after the page is reloaded.
 */
export async function putMedia(blob: Blob): Promise<MediaRef> {
  const hash = hex(await crypto.subtle.digest('SHA-256', await blob.arrayBuffer()))
  const d = await db()
  if (!d) memory.set(hash, blob)
  else {
    await transactIn(d, [FILES, ORPHANS], 'readwrite', (tx) => {
      tx.objectStore(FILES).put(blob, hash)
      // kept again: whatever the collector thought of it
      tx.objectStore(ORPHANS).delete(hash)
    })
  }
  return `media:${hash}`
}

export async function getMedia(ref: MediaRef): Promise<Blob | null> {
  const hash = ref.slice(6)
  const d = await db()
  if (!d) return memory.get(hash) ?? null
  try {
    return (await transactIn(d, [FILES], 'readonly', (tx) => request<Blob | undefined>(tx.objectStore(FILES).get(hash)))) ?? null
  } catch {
    return null
  }
}

/** What the collector does with the files: marks, unmarks and deletes. */
export interface Sweep {
  mark: string[]
  unmark: string[]
  remove: string[]
}

/**
 * The collector's decision (hashes). A file nothing refers to gets a mark; one marked `ORPHAN_MS`
 * ago and still unreferenced goes, as does an unreferenced one in `now` (the files of a campaign
 * just deleted); a file referred to again loses its mark, and so does a mark without a file.
 */
export function sweep(files: string[], marks: Map<string, number>, used: ReadonlySet<string>, at: number, now: ReadonlySet<string> = new Set()): Sweep {
  const out: Sweep = { mark: [], unmark: [], remove: [] }
  const present = new Set(files)
  for (const h of files) {
    const since = marks.get(h)
    if (used.has(h)) {
      if (since !== undefined) out.unmark.push(h)
    } else if (now.has(h) || (since !== undefined && at - since >= ORPHAN_MS)) out.remove.push(h)
    else if (since === undefined) out.mark.push(h)
  }
  for (const h of marks.keys()) if (!present.has(h)) out.unmark.push(h)
  return out
}

/**
 * Collects the files no campaign refers to (`used` — every «media:…» reference of the documents);
 * `now` — references to drop without waiting (a deleted campaign's). Returns how many went.
 */
export async function collectMedia(used: ReadonlySet<string>, now: ReadonlySet<string> = new Set(), at = Date.now()): Promise<number> {
  const d = await db()
  if (!d) return 0
  const hash = (refs: ReadonlySet<string>) => new Set([...refs].map((r) => r.slice(6)))
  const gone = await transactIn(d, [FILES, ORPHANS], 'readwrite', async (tx) => {
    const files = tx.objectStore(FILES)
    const orphans = tx.objectStore(ORPHANS)
    const [keys, markKeys, markTimes] = await Promise.all([
      request(files.getAllKeys()),
      request(orphans.getAllKeys()),
      request<number[]>(orphans.getAll())
    ])
    const marks = new Map(markKeys.map((k, i) => [k as string, markTimes[i]]))
    const s = sweep(keys as string[], marks, hash(used), at, hash(now))
    for (const h of s.mark) orphans.put(at, h)
    for (const h of s.unmark) orphans.delete(h)
    for (const h of s.remove) {
      files.delete(h)
      orphans.delete(h)
    }
    return s.remove
  })
  for (const h of gone) forget(`media:${h}`)
  return gone.length
}

// one object URL per file for the whole page
const urls = new Map<string, Promise<string | null>>()

// a deleted file: its object URL lets the bytes go
function forget(ref: MediaRef) {
  const url = urls.get(ref)
  urls.delete(ref)
  url?.then((u) => u && URL.revokeObjectURL(u))
}
export function mediaUrl(ref: MediaRef): Promise<string | null> {
  if (!urls.has(ref)) urls.set(ref, getMedia(ref).then((b) => (b ? URL.createObjectURL(b) : null)))
  return urls.get(ref)!
}

/** The URL of a stored file for an <img>; null while it loads or when there is none. */
export function useMediaUrl(ref: MediaRef | null): string | null {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    let live = true
    setUrl(null)
    if (ref) mediaUrl(ref).then((u) => live && setUrl(u))
    return () => {
      live = false
    }
  }, [ref])
  return url
}

/**
 * A picture of a sheet (a portrait, a companion): at most `max` px on the longer side, WebP
 * (JPEG where the browser cannot write WebP). A phone photo of a few MB becomes tens of KB.
 */
export async function pictureBlob(file: Blob, max = 512): Promise<Blob> {
  const bmp = await createImageBitmap(file)
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height))
  const w = Math.max(1, Math.round(bmp.width * k))
  const h = Math.max(1, Math.round(bmp.height * k))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, w, h)
  bmp.close()
  const encode = (type: string) => new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.85))
  const webp = await encode('image/webp')
  return webp?.type === 'image/webp' ? webp : (await encode('image/jpeg'))!
}

/** A picture chosen by the player, or one kept in an old sheet as a data URL, into the store. */
export async function storePicture(source: Blob | string): Promise<MediaRef> {
  const blob = typeof source === 'string' ? await (await fetch(source)).blob() : source
  return putMedia(await pictureBlob(blob))
}
