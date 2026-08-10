import type { DrawingData } from '@/types';
import { parseDrawingData } from './drawingValidation';

const DB_NAME = 'pixelperfect';
const DB_VERSION = 1;
const STORE = 'offline-queue';
const LEGACY_PREFIX = 'pp_offline_';

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function run<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const req = fn(tx.objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      })
  );
}

function migrateLegacy(id: string): DrawingData | null {
  try {
    const raw = localStorage.getItem(LEGACY_PREFIX + id);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    const validated = parseDrawingData(parsed);
    localStorage.removeItem(LEGACY_PREFIX + id);
    return validated;
  } catch {
    // Validation failed or JSON parse failed: purge the corrupted entry
    localStorage.removeItem(LEGACY_PREFIX + id);
    return null;
  }
}

export async function enqueue(id: string, data: DrawingData): Promise<void> {
  try {
    await run('readwrite', (store) => store.put(data, id));
  } catch {
    /* IDB unavailable */
  }
}

export async function dequeue(id: string): Promise<void> {
  try {
    await run('readwrite', (store) => store.delete(id));
  } catch {
    /* IDB unavailable */
  }
  try {
    localStorage.removeItem(LEGACY_PREFIX + id);
  } catch {
    /* */
  }
}

export async function getPending(id: string): Promise<DrawingData | null> {
  try {
    const existing = await run<DrawingData | undefined>(
      'readonly',
      (store) => store.get(id) as IDBRequest<DrawingData | undefined>
    );
    if (existing) {
      try {
        // Validate data from IndexedDB
        return parseDrawingData(existing);
      } catch {
        // Data is corrupted: purge and return null
        await dequeue(id);
        return null;
      }
    }
    const legacy = migrateLegacy(id);
    if (legacy) {
      await enqueue(id, legacy);
      return legacy;
    }
    return null;
  } catch {
    // IDB read failed: try legacy migration
    const legacy = migrateLegacy(id);
    if (legacy) {
      try {
        await enqueue(id, legacy);
      } catch {
        // Enqueue failed but we still return the validated legacy data
      }
    }
    return legacy;
  }
}
