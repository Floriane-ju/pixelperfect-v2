import { parseDrawingData } from './drawingValidation';
import type { DrawingData, DrawingRow } from '@/types';

/**
 * Bibliothèque locale (utilisateur non connecté), persistée durablement dans IndexedDB.
 * Base séparée de `pixelperfect` (file offline) pour ne pas avoir à coordonner la version
 * du schéma avec `offlineQueue.ts`.
 */
const DB_NAME = 'pixelperfect-library';
const DB_VERSION = 1;
const STORE = 'drawings';

/** owner_id sentinelle des dessins locaux : aucun utilisateur Supabase. */
export const LOCAL_OWNER = 'local';

export interface LocalDrawing {
  id: string;
  title: string;
  data: DrawingData;
  created_at: string;
  updated_at: string;
  group: string | null;
}

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
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function get(id: string): Promise<unknown> {
  return openDb().then(
    (db) =>
      new Promise<unknown>((resolve, reject) => {
        const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(id);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      }),
  );
}

function getAll(): Promise<unknown[]> {
  return openDb().then(
    (db) =>
      new Promise<unknown[]>((resolve, reject) => {
        const req = db.transaction(STORE, 'readonly').objectStore(STORE).getAll();
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      }),
  );
}

/** Écriture atomique : résout sur la validation de la transaction (tx.oncomplete), pas le req. */
function write(fn: (store: IDBObjectStore) => void): Promise<void> {
  return openDb().then(
    (db) =>
      new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE, 'readwrite');
        fn(tx.objectStore(STORE));
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      }),
  );
}

/** Lecture-modification-écriture atomique dans une seule transaction (pas de race lost-update). */
function modify(id: string, mutate: (d: LocalDrawing) => void): Promise<void> {
  return openDb().then(
    (db) =>
      new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE, 'readwrite');
        const store = tx.objectStore(STORE);
        const req = store.get(id);
        req.onsuccess = () => {
          const raw = req.result;
          if (raw === undefined) return; // id inconnu : la transaction se termine sans écriture
          let drawing: LocalDrawing;
          try {
            drawing = parseLocalDrawing(raw);
          } catch {
            return;
          }
          mutate(drawing);
          drawing.updated_at = nowIso();
          store.put(drawing);
        };
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      }),
  );
}

function parseLocalDrawing(raw: unknown): LocalDrawing {
  if (typeof raw !== 'object' || raw === null) throw new Error('Invalid LocalDrawing');
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== 'string') throw new Error('Invalid LocalDrawing: id');
  if (typeof r.title !== 'string') throw new Error('Invalid LocalDrawing: title');
  if (typeof r.created_at !== 'string') throw new Error('Invalid LocalDrawing: created_at');
  if (typeof r.updated_at !== 'string') throw new Error('Invalid LocalDrawing: updated_at');
  if (r.group !== null && typeof r.group !== 'string') throw new Error('Invalid LocalDrawing: group');
  return {
    id: r.id,
    title: r.title,
    data: parseDrawingData(r.data),
    created_at: r.created_at,
    updated_at: r.updated_at,
    group: r.group,
  };
}

export function toRow(d: LocalDrawing): DrawingRow {
  return {
    id: d.id,
    title: d.title,
    data: d.data,
    created_at: d.created_at,
    updated_at: d.updated_at,
    group: d.group,
    owner_id: LOCAL_OWNER,
    collaborator_count: 0,
  };
}

function nowIso(): string {
  return new Date().toISOString();
}

/** Tous les dessins locaux validés, triés par date de modification décroissante (ISO lexicographique). */
export async function getAllLocal(): Promise<LocalDrawing[]> {
  const raws = await getAll();
  const parsed: LocalDrawing[] = [];
  for (const raw of raws) {
    try {
      parsed.push(parseLocalDrawing(raw));
    } catch {
      // ignorer les entrées corrompues plutôt que casser toute la galerie
    }
  }
  parsed.sort((a, b) => (a.updated_at < b.updated_at ? 1 : a.updated_at > b.updated_at ? -1 : 0));
  return parsed;
}

/** Insère en masse des dessins déjà validés (utilisé par l'import). */
export async function bulkAddLocal(drawings: LocalDrawing[]): Promise<void> {
  await write((store) => {
    for (const d of drawings) store.put(d);
  });
}

export async function localFetchDrawings(): Promise<DrawingRow[]> {
  const all = await getAllLocal();
  return all.map(toRow);
}

export async function localFetchDrawing(id: string): Promise<DrawingRow> {
  const raw = await get(id);
  if (raw === undefined) throw new Error('Dessin introuvable');
  return toRow(parseLocalDrawing(raw));
}

export async function localCreateDrawing(
  title: string,
  width: number,
  height: number,
): Promise<DrawingRow> {
  const data: DrawingData = {
    width,
    height,
    layers: [{ id: crypto.randomUUID(), name: 'Calque 1', pixels: {}, opacity: 1, visible: true }],
  };
  const ts = nowIso();
  const drawing: LocalDrawing = {
    id: crypto.randomUUID(),
    title,
    data,
    created_at: ts,
    updated_at: ts,
    group: null,
  };
  await write((store) => store.put(drawing));
  return toRow(drawing);
}

export async function localUpdateDrawingData(id: string, data: DrawingData): Promise<void> {
  await modify(id, (d) => {
    d.data = data;
  });
}

export async function localRenameDrawing(id: string, title: string): Promise<void> {
  await modify(id, (d) => {
    d.title = title;
  });
}

export async function localDeleteDrawing(id: string): Promise<void> {
  await write((store) => store.delete(id));
}

export async function localRemoveFromGroup(id: string): Promise<void> {
  await modify(id, (d) => {
    d.group = null;
  });
}

export async function localMoveToGroup(id: string, group: string): Promise<void> {
  await modify(id, (d) => {
    d.group = group;
  });
}

/** Renomme un groupe en une seule transaction (curseur) pour rester atomique. */
export async function localRenameGroup(oldName: string, newName: string): Promise<void> {
  const ts = nowIso();
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const cursorReq = tx.objectStore(STORE).openCursor();
    cursorReq.onsuccess = () => {
      const cursor = cursorReq.result;
      if (!cursor) return;
      try {
        const d = parseLocalDrawing(cursor.value);
        if (d.group === oldName) {
          d.group = newName;
          d.updated_at = ts;
          cursor.update(d);
        }
      } catch {
        // ignorer une entrée corrompue
      }
      cursor.continue();
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}
