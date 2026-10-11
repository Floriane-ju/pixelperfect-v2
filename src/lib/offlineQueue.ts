import { parseDrawingData } from './drawingValidation';
import type { DrawingData } from '@/types';

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
    req.onsuccess = () => {
      const db = req.result;
      // iOS ferme la connexion en arrière-plan : sans reset, chaque transaction lèverait
      // InvalidStateError jusqu'au rechargement.
      db.onclose = () => { dbPromise = null; };
      db.onversionchange = () => { db.close(); dbPromise = null; };
      resolve(db);
    };
    req.onerror = () => {
      dbPromise = null;
      reject(req.error);
    };
  });
  return dbPromise;
}

function run<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(db => new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const req = fn(tx.objectStore(STORE));
    // Résout sur le commit de la transaction : req.onsuccess précède l'écriture durable.
    tx.oncomplete = () => resolve(req.result);
    tx.onerror = () => reject(req.error ?? tx.error);
    tx.onabort = () => reject(tx.error);
  }));
}

function migrateLegacy(id: string): DrawingData | null {
  try {
    const raw = localStorage.getItem(LEGACY_PREFIX + id);
    if (!raw) return null;
    localStorage.removeItem(LEGACY_PREFIX + id);
    return parseDrawingData(JSON.parse(raw));
  } catch {
    return null;
  }
}

export async function enqueue(id: string, data: DrawingData): Promise<void> {
  try {
    await run('readwrite', store => store.put(data, id));
  } catch {
    /* IDB unavailable */
  }
}

export async function dequeue(id: string): Promise<void> {
  try {
    await run('readwrite', store => store.delete(id));
  } catch {
    /* IDB unavailable */
  }
  try { localStorage.removeItem(LEGACY_PREFIX + id); } catch { /* */ }
}

export async function getPending(id: string): Promise<DrawingData | null> {
  try {
    const existing = await run<unknown>('readonly', store => store.get(id));
    // Donnée locale non fiable (version antérieure, corruption) : validée avant d'être renvoyée
    // au serveur, et purgée si invalide pour ne pas être relue à chaque synchro.
    if (existing !== undefined) {
      try {
        return parseDrawingData(existing);
      } catch {
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
    return migrateLegacy(id);
  }
}
