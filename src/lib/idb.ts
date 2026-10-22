import type { MemoryPhoto, MuseumProfile } from '../types'
import { EMPTY_PROFILE } from '../types'

const DB_NAME = 'memory-lane-hall'
const DB_VERSION = 1
const PROFILE_STORE = 'profile'
const TRACK_STORE = 'tracks'
const CHUNK_STORE = 'chunks'

export interface StoredTrack {
  videoId: string
  title: string
  mimeType: string
  duration: number
  blob: Blob | null
  bytes: number
  totalBytes: number
  complete: boolean
  updatedAt: number
}

export interface StoredChunk {
  id: string
  videoId: string
  seq: number
  data: ArrayBuffer
}

let dbPromise: Promise<IDBDatabase> | null = null

function hasIndexedDB(): boolean {
  try {
    return typeof indexedDB !== 'undefined' && indexedDB !== null
  } catch {
    return false
  }
}

export function openDB(): Promise<IDBDatabase> {
  if (!hasIndexedDB()) {
    return Promise.reject(new Error('IndexedDB unavailable'))
  }
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    let request: IDBOpenDBRequest
    try {
      request = indexedDB.open(DB_NAME, DB_VERSION)
    } catch (err) {
      reject(err)
      return
    }
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(PROFILE_STORE)) {
        db.createObjectStore(PROFILE_STORE, { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains(TRACK_STORE)) {
        db.createObjectStore(TRACK_STORE, { keyPath: 'videoId' })
      }
      if (!db.objectStoreNames.contains(CHUNK_STORE)) {
        const store = db.createObjectStore(CHUNK_STORE, { keyPath: 'id' })
        store.createIndex('byVideo', 'videoId', { unique: false })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB open failed'))
    request.onblocked = () => reject(new Error('IndexedDB blocked'))
  })
  return dbPromise
}

function tx<T>(
  stores: string[],
  mode: IDBTransactionMode,
  run: (t: IDBTransaction) => Promise<T> | T,
): Promise<T> {
  return openDB().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        let transaction: IDBTransaction
        try {
          transaction = db.transaction(stores, mode)
        } catch (err) {
          reject(err)
          return
        }
        let result: T | undefined
        let failure: unknown = null
        let finished = false
        let runSettled = false
        let transactionDone = false

        const settle = () => {
          if (finished) return
          finished = true
          if (failure) reject(failure)
          else resolve(result as T)
        }

        const maybeSettle = () => {
          if (runSettled && transactionDone) settle()
        }

        transaction.oncomplete = () => {
          transactionDone = true
          maybeSettle()
        }
        transaction.onerror = () => {
          failure = transaction.error ?? new Error('IndexedDB transaction failed')
          settle()
        }
        transaction.onabort = () => {
          failure = transaction.error ?? new Error('IndexedDB transaction aborted')
          settle()
        }

        try {
          Promise.resolve(run(transaction)).then(
            (value) => {
              result = value
              runSettled = true
              maybeSettle()
            },
            (err) => {
              failure = err
              runSettled = true
              try {
                transaction.abort()
              } catch {
                /* already gone */
              }
              settle()
            },
          )
        } catch (err) {
          failure = err
          runSettled = true
          settle()
        }
      }),
  )
}

function reqToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'))
  })
}

/* ------------------------------------------------------------------ profile */

export async function saveProfile(profile: MuseumProfile): Promise<void> {
  const record = { ...profile, updatedAt: Date.now() }
  try {
    await tx([PROFILE_STORE], 'readwrite', (t) => {
      t.objectStore(PROFILE_STORE).put(record)
    })
  } catch {
    // localStorage fallback keeps the experience working without IndexedDB
    try {
      localStorage.setItem('memoryLaneProfile', JSON.stringify(record))
    } catch {
      /* ignore */
    }
  }
}

export async function loadProfile(): Promise<MuseumProfile | null> {
  try {
    const record = await tx([PROFILE_STORE], 'readonly', async (t) => {
      const value = await reqToPromise<MuseumProfile | undefined>(
        t.objectStore(PROFILE_STORE).get('default') as IDBRequest<MuseumProfile | undefined>,
      )
      return value
    })
    if (record && Array.isArray(record.photos)) {
      return { ...EMPTY_PROFILE, ...record, photos: record.photos as MemoryPhoto[] }
    }
  } catch {
    /* fall through */
  }
  try {
    const raw = localStorage.getItem('memoryLaneProfile')
    if (raw) {
      const parsed = JSON.parse(raw) as MuseumProfile
      if (parsed && Array.isArray(parsed.photos)) {
        return { ...EMPTY_PROFILE, ...parsed, photos: parsed.photos }
      }
    }
  } catch {
    /* ignore */
  }
  return null
}

export async function clearProfile(): Promise<void> {
  try {
    await tx([PROFILE_STORE], 'readwrite', (t) => {
      t.objectStore(PROFILE_STORE).delete('default')
    })
  } catch {
    /* ignore */
  }
  try {
    localStorage.removeItem('memoryLaneProfile')
  } catch {
    /* ignore */
  }
}

/* ------------------------------------------------------------------- tracks */

export async function getTrack(videoId: string): Promise<StoredTrack | null> {
  try {
    const track = await tx([TRACK_STORE], 'readonly', async (t) => {
      return reqToPromise<StoredTrack | undefined>(
        t.objectStore(TRACK_STORE).get(videoId) as IDBRequest<StoredTrack | undefined>,
      )
    })
    return track ?? null
  } catch {
    return null
  }
}

export async function putTrack(track: StoredTrack): Promise<void> {
  try {
    await tx([TRACK_STORE], 'readwrite', (t) => {
      t.objectStore(TRACK_STORE).put(track)
    })
  } catch {
    /* ignore */
  }
}

export async function deleteTrack(videoId: string): Promise<void> {
  try {
    await tx([TRACK_STORE, CHUNK_STORE], 'readwrite', (t) => {
      t.objectStore(TRACK_STORE).delete(videoId)
      const index = t.objectStore(CHUNK_STORE).index('byVideo')
      const cursorReq = index.openCursor(IDBKeyRange.only(videoId))
      cursorReq.onsuccess = () => {
        const cursor = cursorReq.result
        if (cursor) {
          cursor.delete()
          cursor.continue()
        }
      }
    })
  } catch {
    /* ignore */
  }
}

/* ------------------------------------------------------------------- chunks */

export async function getChunks(videoId: string): Promise<StoredChunk[]> {
  try {
    const chunks = await tx([CHUNK_STORE], 'readonly', async (t) => {
      const index = t.objectStore(CHUNK_STORE).index('byVideo')
      const all = await reqToPromise<StoredChunk[]>(
        index.getAll(IDBKeyRange.only(videoId)) as IDBRequest<StoredChunk[]>,
      )
      return all
    })
    return chunks.sort((a, b) => a.seq - b.seq)
  } catch {
    return []
  }
}

export async function putChunk(chunk: StoredChunk): Promise<void> {
  try {
    await tx([CHUNK_STORE], 'readwrite', (t) => {
      t.objectStore(CHUNK_STORE).put(chunk)
    })
  } catch {
    /* ignore */
  }
}

export async function clearChunks(videoId: string): Promise<void> {
  try {
    await tx([CHUNK_STORE], 'readwrite', (t) => {
      const index = t.objectStore(CHUNK_STORE).index('byVideo')
      const cursorReq = index.openCursor(IDBKeyRange.only(videoId))
      cursorReq.onsuccess = () => {
        const cursor = cursorReq.result
        if (cursor) {
          cursor.delete()
          cursor.continue()
        }
      }
    })
  } catch {
    /* ignore */
  }
}
