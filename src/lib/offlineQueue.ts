import { isRecord, parseDrawingData } from './drawingValidation';
import { SaveRejectedError } from './saveErrors';
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

/** Entrée de file : `savedAt` (ms, horloge locale) est absent pour les entrées héritées. */
export interface PendingEntry {
  data: DrawingData;
  rev: number;
  savedAt: number | null;
}

/**
 * Dernière révision mise en file par cet onglet, par dessin : un envoi plus ancien qui se termine
 * après ne doit pas effacer l'entrée plus récente (sans relire ni comparer le dessin entier).
 */
const lastRev = new Map<string, number>();
let revSeq = 0;
/** Dessins ouverts dans l'éditeur : leur file est gérée par useSave, flushAll les ignore. */
const heldByEditor = new Set<string>();

export function holdForEditor(id: string): () => void {
  heldByEditor.add(id);
  return () => { heldByEditor.delete(id); };
}

/** Met le dessin en file et renvoie sa révision (réservée dès l'appel, avant l'écriture). */
export async function enqueue(id: string, data: DrawingData): Promise<number> {
  const savedAt = Date.now();
  const rev = savedAt * 1000 + (revSeq++ % 1000);
  lastRev.set(id, rev);
  try {
    await run('readwrite', store => store.put({ rev, savedAt, data }, id));
  } catch {
    /* IDB unavailable */
  }
  return rev;
}

/** Retire l'entrée ; avec `rev`, seulement si aucune révision plus récente n'a été mise en file depuis. */
export async function dequeue(id: string, rev?: number): Promise<void> {
  const latest = lastRev.get(id);
  if (rev !== undefined && latest !== undefined && latest !== rev) return;
  lastRev.delete(id);
  try {
    await run('readwrite', store => store.delete(id));
  } catch {
    /* IDB unavailable */
  }
  try { localStorage.removeItem(LEGACY_PREFIX + id); } catch { /* */ }
}

function parseEntry(raw: unknown): PendingEntry {
  if (isRecord(raw) && typeof raw.rev === 'number' && typeof raw.savedAt === 'number' && 'data' in raw) {
    return { data: parseDrawingData(raw.data), rev: raw.rev, savedAt: raw.savedAt };
  }
  // Format antérieur : DrawingData brut, sans date.
  return { data: parseDrawingData(raw), rev: 0, savedAt: null };
}

export async function getPendingEntry(id: string): Promise<PendingEntry | null> {
  try {
    const existing = await run<unknown>('readonly', store => store.get(id));
    // Donnée locale non fiable (version antérieure, corruption) : validée avant d'être renvoyée
    // au serveur, et purgée si invalide pour ne pas être relue à chaque synchro.
    if (existing !== undefined) {
      try {
        return parseEntry(existing);
      } catch {
        await dequeue(id);
        return null;
      }
    }
    const legacy = migrateLegacy(id);
    if (!legacy) return null;
    const rev = await enqueue(id, legacy);
    return { data: legacy, rev, savedAt: null };
  } catch {
    const legacy = migrateLegacy(id);
    return legacy ? { data: legacy, rev: 0, savedAt: null } : null;
  }
}

export async function getPending(id: string): Promise<DrawingData | null> {
  return (await getPendingEntry(id))?.data ?? null;
}

/**
 * Renvoie une entrée au serveur. Refus définitif (accès retiré, dessin supprimé) : purgée, sinon
 * elle serait retentée à chaque connexion. Échec réseau : gardée pour plus tard.
 */
export async function replay(
  id: string,
  entry: PendingEntry,
  upload: (id: string, data: DrawingData) => Promise<void>,
): Promise<boolean> {
  try {
    await upload(id, entry.data);
    await dequeue(id, entry.rev);
    return true;
  } catch (err) {
    if (err instanceof SaveRejectedError) await dequeue(id, entry.rev);
    return false;
  }
}

/** Renvoie au serveur toutes les entrées en file, y compris celles des dessins jamais rouverts. */
export async function flushAll(upload: (id: string, data: DrawingData) => Promise<void>): Promise<void> {
  let ids: IDBValidKey[];
  try {
    ids = await run('readonly', store => store.getAllKeys());
  } catch {
    return;
  }
  for (const key of ids) {
    if (typeof key !== 'string' || heldByEditor.has(key)) continue;
    const entry = await getPendingEntry(key);
    if (entry) await replay(key, entry, upload);
  }
}
