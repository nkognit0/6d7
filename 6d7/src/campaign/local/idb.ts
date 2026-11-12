// A few promises around IndexedDB: the campaigns of this browser live there until the server.

export const DB_NAME = 'vtt-campaigns'
const VERSION = 1

/** Store names and their keys. */
export const S = {
  /** [campaign id, document key] → document */
  docs: 'docs',
  /** [campaign id, number] → change */
  journal: 'journal',
  /** campaign id → CampaignMeta */
  meta: 'meta',
  /** [picture id, level, column, row] → Blob */
  tiles: 'tiles',
  /** code → { code, campaign, player } */
  codes: 'codes'
} as const

let opened: Promise<IDBDatabase> | null = null

export function db(): Promise<IDBDatabase> {
  opened ??= new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION)
    req.onupgradeneeded = () => {
      const d = req.result
      d.createObjectStore(S.docs)
      d.createObjectStore(S.journal)
      d.createObjectStore(S.meta)
      d.createObjectStore(S.tiles)
      d.createObjectStore(S.codes, { keyPath: 'code' }).createIndex('campaign', 'campaign')
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
    req.onblocked = () => reject(new Error('the database is blocked by another tab'))
  }).catch((e) => {
    opened = null
    throw e
  })
  return opened
}

export function request<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result)
    r.onerror = () => reject(r.error)
  })
}

/** Runs `fn` in one transaction; resolves when it is committed. */
export async function transact<T>(stores: string[], mode: IDBTransactionMode, fn: (tx: IDBTransaction) => T | Promise<T>): Promise<T> {
  const tx = (await db()).transaction(stores, mode)
  const done = new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error ?? new Error('transaction aborted'))
  })
  const result = await fn(tx)
  await done
  return result
}

/** Every key that starts with `prefix` (compound keys: arrays sort after numbers and strings). */
export const prefixRange = (...prefix: (string | number)[]) => IDBKeyRange.bound(prefix, [...prefix, []])
