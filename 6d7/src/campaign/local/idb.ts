// A few promises around IndexedDB: the campaigns of this browser live there until the server.

export const DB_NAME = '6d7-campaigns'
/** The name the app gave the database before it was called 6d7: moved over once. */
const FORMER_NAME = 'vtt-campaigns'
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
  opened ??= openDatabase(DB_NAME, VERSION, (d) => {
    d.createObjectStore(S.docs)
    d.createObjectStore(S.journal)
    d.createObjectStore(S.meta)
    d.createObjectStore(S.tiles)
    d.createObjectStore(S.codes, { keyPath: 'code' }).createIndex('campaign', 'campaign')
  }, FORMER_NAME).then((d) => {
    // another tab upgrades or deletes the database: this one lets go and opens it again later
    d.onversionchange = () => {
      d.close()
      opened = null
    }
    return d
  }).catch((e) => {
    opened = null
    throw e
  })
  return opened
}

type Entries = Map<string, [IDBValidKey | undefined, unknown][]>

// everything a database holds, store by store; null when there is no such database
async function readAll(name: string): Promise<Entries | null> {
  const d = await new Promise<IDBDatabase | null>((resolve) => {
    try {
      const req = indexedDB.open(name)
      // no such database: opening would create it, the abort takes that back
      req.onupgradeneeded = () => req.transaction?.abort()
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => resolve(null)
      req.onblocked = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
  if (!d) return null
  try {
    const names = [...d.objectStoreNames]
    if (!names.length) return null
    const tx = d.transaction(names, 'readonly')
    const out: Entries = new Map()
    await Promise.all(names.map(async (n) => {
      const store = tx.objectStore(n)
      // both lists come in the order of the keys; a store with keys inside its values takes the values alone
      const [keys, values] = await Promise.all([request(store.getAllKeys()), request(store.getAll())])
      out.set(n, values.map((v, i) => [store.keyPath === null ? keys[i] : undefined, v]))
    }))
    return out
  } finally {
    d.close()
  }
}

/**
 * Opens a database; `upgrade` makes its stores (`from` — the version it had, 0 for a new one).
 * `former` — the name it had before: its contents move into the new one in the same transaction
 * that creates it (all or nothing: an interrupted move happens again next time), then the old
 * database goes.
 */
export async function openDatabase(name: string, version: number, upgrade: (d: IDBDatabase, from: number) => void, former?: string): Promise<IDBDatabase> {
  const moved = former ? await readAll(former) : null
  const d = await new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(name, version)
    req.onupgradeneeded = (e) => {
      const d = req.result
      upgrade(d, e.oldVersion)
      if (e.oldVersion) return
      for (const [store, entries] of moved ?? []) {
        if (!d.objectStoreNames.contains(store)) continue
        const s = req.transaction!.objectStore(store)
        for (const [key, value] of entries) {
          if (key === undefined) s.put(value)
          else s.put(value, key)
        }
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
    req.onblocked = () => reject(new Error('the database is blocked by another tab'))
  })
  // moved now or before: the old name is not needed (a tab of an older version may hold it a while)
  if (moved) indexedDB.deleteDatabase(former!)
  return d
}

export function request<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result)
    r.onerror = () => reject(r.error)
  })
}

/**
 * Runs `fn` in one transaction of the campaigns' database; resolves when it is committed. If `fn`
 * throws, the transaction is aborted: nothing it wrote stays (a snapshot that deleted the old
 * documents and failed to write the new ones leaves the old ones).
 */
export async function transact<T>(stores: string[], mode: IDBTransactionMode, fn: (tx: IDBTransaction) => T | Promise<T>): Promise<T> {
  return transactIn(await db(), stores, mode, fn)
}

/** `transact` in any database. */
export async function transactIn<T>(d: IDBDatabase, stores: string[], mode: IDBTransactionMode, fn: (tx: IDBTransaction) => T | Promise<T>): Promise<T> {
  const tx = d.transaction(stores, mode)
  const done = new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error ?? new Error('transaction aborted'))
  })
  let result: T
  try {
    result = await fn(tx)
  } catch (e) {
    done.catch(() => {})
    try {
      tx.abort()
    } catch {
      // already over: aborted by a failed request, or committed
    }
    throw e
  }
  await done
  return result
}

/** Every key that starts with `prefix` (compound keys: arrays sort after numbers and strings). */
export const prefixRange = (...prefix: (string | number)[]) => IDBKeyRange.bound(prefix, [...prefix, []])
