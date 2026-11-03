// The media store (docs/data-model.md): files addressed by the SHA-256 of their bytes
// («media:<hex>»). A file never changes, so a reference stays valid and the same picture is kept
// once. Until the server exists the files live in the browser's IndexedDB; without it (a private
// window) they live for the session in memory.
import { useEffect, useState } from 'react'
import type { MediaRef } from '../seat/seat'

const DB = 'vtt-media'
const STORE = 'files'
const memory = new Map<string, Blob>()
let opened: Promise<IDBDatabase | null> | null = null

function db(): Promise<IDBDatabase | null> {
  opened ??= new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB, 1)
      req.onupgradeneeded = () => req.result.createObjectStore(STORE)
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
  return opened
}

function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T | null> {
  return db().then((d) => new Promise((resolve) => {
    if (!d) return resolve(null)
    try {
      const req = fn(d.transaction(STORE, mode).objectStore(STORE))
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => resolve(null)
    } catch {
      resolve(null)
    }
  }))
}

const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')

export async function putMedia(blob: Blob): Promise<MediaRef> {
  const hash = hex(await crypto.subtle.digest('SHA-256', await blob.arrayBuffer()))
  memory.set(hash, blob)
  await run('readwrite', (s) => s.put(blob, hash))
  return `media:${hash}`
}

export async function getMedia(ref: MediaRef): Promise<Blob | null> {
  const hash = ref.slice(6)
  const kept = memory.get(hash) ?? (await run<Blob>('readonly', (s) => s.get(hash)))
  if (kept) memory.set(hash, kept)
  return kept ?? null
}

// one object URL per file for the whole page
const urls = new Map<string, Promise<string | null>>()
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
