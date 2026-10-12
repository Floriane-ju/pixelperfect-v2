import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { DrawingData } from '@/types';

/**
 * Ces tests exercent le vrai `offlineQueue`, jamais un double : c'est précisément la
 * validation du module qui est en cause (SEC-5). Mocker `./offlineQueue` rendrait la suite
 * verte même après suppression de `parseDrawingData` du code de production.
 *
 * jsdom ne fournit pas IndexedDB. Plutôt qu'une dépendance de plus, on pose ici le strict
 * minimum d'API réellement utilisé par le module : `open` (avec `onupgradeneeded`),
 * `transaction`/`objectStore`, et `put`/`get`/`delete`. Les gestionnaires étant affectés
 * APRÈS le retour de l'appel, le faux doit les déclencher de façon asynchrone.
 */

const LEGACY_PREFIX = 'pp_offline_';

const validData: DrawingData = {
  width: 4,
  height: 4,
  layers: [{ id: 'l1', name: 'Calque 1', pixels: { '0,0': '#ff0000' }, opacity: 1, visible: true }],
};

/** Conforme au JSON mais pas au schéma : `width` n'est pas un entier. */
const malformedData = { width: 'quatre', height: 4, layers: [] };

let backingStore: Map<string, unknown>;
let legacyStore: Map<string, string>;

/**
 * `localStorage` n'est pas le module sous test : le doubler est légitime, et l'implémentation
 * fournie par l'environnement de test n'expose pas `clear`.
 */
function installFakeLocalStorage(): void {
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => legacyStore.get(key) ?? null,
    setItem: (key: string, value: string) => void legacyStore.set(key, value),
    removeItem: (key: string) => void legacyStore.delete(key),
  });
}

interface FakeTransaction {
  oncomplete: (() => void) | null;
  onerror: (() => void) | null;
}

/** Sans `tx`, seul `onsuccess` est émis ; avec, le module attend aussi le commit (`oncomplete`). */
function fakeRequest<T>(compute: () => T, tx?: FakeTransaction): IDBRequest<T> {
  const req = { onsuccess: null, onerror: null, result: undefined, error: null } as unknown as {
    onsuccess: (() => void) | null;
    onerror: (() => void) | null;
    result: T | undefined;
    error: unknown;
  };
  queueMicrotask(() => {
    try {
      req.result = compute();
      req.onsuccess?.();
      tx?.oncomplete?.();
    } catch (err) {
      req.error = err;
      req.onerror?.();
      tx?.onerror?.();
    }
  });
  return req as unknown as IDBRequest<T>;
}

function fakeObjectStore(tx?: FakeTransaction) {
  return {
    put: (value: unknown, key: string) => fakeRequest(() => backingStore.set(key, value), tx),
    get: (key: string) => fakeRequest(() => backingStore.get(key), tx),
    delete: (key: string) => fakeRequest(() => backingStore.delete(key), tx),
    getAllKeys: () => fakeRequest(() => [...backingStore.keys()], tx),
  };
}

function installFakeIndexedDb(): void {
  const db = {
    objectStoreNames: { contains: () => true },
    createObjectStore: () => fakeObjectStore(),
    transaction: () => {
      const tx: FakeTransaction & { objectStore: () => ReturnType<typeof fakeObjectStore> } = {
        oncomplete: null,
        onerror: null,
        objectStore: () => fakeObjectStore(tx),
      };
      return tx;
    },
  };
  vi.stubGlobal('indexedDB', {
    open: () => fakeRequest(() => db),
  });
}

/** Le module met `dbPromise` en cache au niveau module : réimporter à neuf à chaque test. */
async function freshModule() {
  vi.resetModules();
  return import('./offlineQueue');
}

beforeEach(() => {
  backingStore = new Map();
  legacyStore = new Map();
  installFakeLocalStorage();
  installFakeIndexedDb();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('offlineQueue — aller-retour', () => {
  it('rend une entrée IndexedDB valide', async () => {
    const { enqueue, getPending } = await freshModule();
    await enqueue('d1', validData);

    expect(await getPending('d1')).toEqual(validData);
  });

  it('rend null après dequeue', async () => {
    const { enqueue, dequeue, getPending } = await freshModule();
    await enqueue('d1', validData);
    await dequeue('d1');

    expect(await getPending('d1')).toBeNull();
  });

  it('rend null quand rien n’est en file', async () => {
    const { getPending } = await freshModule();

    expect(await getPending('inconnu')).toBeNull();
  });

  it('tient plusieurs entrées indépendantes', async () => {
    const { enqueue, getPending } = await freshModule();
    const autre: DrawingData = { ...validData, width: 8, height: 8 };
    await enqueue('d1', validData);
    await enqueue('d2', autre);

    expect((await getPending('d1'))?.width).toBe(4);
    expect((await getPending('d2'))?.width).toBe(8);
  });
});

describe('offlineQueue — validation IndexedDB (SEC-5)', () => {
  it('rend null ET purge une entrée IndexedDB non conforme', async () => {
    const { getPending } = await freshModule();
    // Écriture directe dans le magasin : simule une entrée corrompue déjà en base,
    // ce qu'`enqueue` ne permettrait pas de produire.
    backingStore.set('d1', malformedData);

    expect(await getPending('d1')).toBeNull();
    expect(backingStore.has('d1')).toBe(false);
  });

  it('purge une entrée dont un calque est corrompu', async () => {
    const { getPending } = await freshModule();
    backingStore.set('d1', {
      width: 4,
      height: 4,
      layers: [{ id: 'l1', name: 'Calque 1', pixels: null, opacity: 1, visible: true }],
    });

    expect(await getPending('d1')).toBeNull();
    expect(backingStore.has('d1')).toBe(false);
  });

  it('refuse une couleur hors format hexadécimal', async () => {
    const { getPending } = await freshModule();
    backingStore.set('d1', {
      width: 4,
      height: 4,
      layers: [
        { id: 'l1', name: 'Calque 1', pixels: { '0,0': 'rouge' }, opacity: 1, visible: true },
      ],
    });

    expect(await getPending('d1')).toBeNull();
    expect(backingStore.has('d1')).toBe(false);
  });

  it('ne lève jamais sur données corrompues', async () => {
    const { getPending } = await freshModule();
    backingStore.set('d1', malformedData);

    await expect(getPending('d1')).resolves.toBeNull();
  });
});

describe('offlineQueue — migration localStorage héritée', () => {
  it('migre une entrée héritée valide, la retire de localStorage et la remet en file', async () => {
    const { getPending } = await freshModule();
    localStorage.setItem(LEGACY_PREFIX + 'd1', JSON.stringify(validData));

    expect(await getPending('d1')).toEqual(validData);
    expect(localStorage.getItem(LEGACY_PREFIX + 'd1')).toBeNull();
    expect(backingStore.get('d1')).toMatchObject({ data: validData });
  });

  it('rend null ET purge un JSON hérité illisible', async () => {
    const { getPending } = await freshModule();
    localStorage.setItem(LEGACY_PREFIX + 'd1', '{json tronqué');

    expect(await getPending('d1')).toBeNull();
    expect(localStorage.getItem(LEGACY_PREFIX + 'd1')).toBeNull();
  });

  it('rend null ET purge un JSON hérité lisible mais non conforme', async () => {
    const { getPending } = await freshModule();
    localStorage.setItem(LEGACY_PREFIX + 'd1', JSON.stringify(malformedData));

    expect(await getPending('d1')).toBeNull();
    expect(localStorage.getItem(LEGACY_PREFIX + 'd1')).toBeNull();
  });

  it('purge aussi l’entrée héritée au dequeue', async () => {
    const { dequeue } = await freshModule();
    localStorage.setItem(LEGACY_PREFIX + 'd1', JSON.stringify(validData));
    await dequeue('d1');

    expect(localStorage.getItem(LEGACY_PREFIX + 'd1')).toBeNull();
  });
});

describe('offlineQueue — IndexedDB indisponible', () => {
  it('bascule sur localStorage et valide quand même', async () => {
    vi.stubGlobal('indexedDB', undefined);
    const { getPending } = await freshModule();
    localStorage.setItem(LEGACY_PREFIX + 'd1', JSON.stringify(validData));

    expect(await getPending('d1')).toEqual(validData);
  });

  it('rend null sur entrée héritée non conforme, même sans IndexedDB', async () => {
    vi.stubGlobal('indexedDB', undefined);
    const { getPending } = await freshModule();
    localStorage.setItem(LEGACY_PREFIX + 'd1', JSON.stringify(malformedData));

    expect(await getPending('d1')).toBeNull();
    expect(localStorage.getItem(LEGACY_PREFIX + 'd1')).toBeNull();
  });
});

describe('offlineQueue — révisions et concurrence', () => {
  it('dequeue(rev) garde une révision plus récente mise en file par un autre onglet', async () => {
    const tabA = await freshModule();
    const oldRev = await tabA.enqueue('d1', validData);
    const tabB = await freshModule();
    const newer = { ...validData, width: 8 };
    await tabB.enqueue('d1', newer);

    await tabA.dequeue('d1', oldRev);

    expect(await tabA.getPending('d1')).toEqual(newer);
  });

  it('dequeue(rev) retire l’entrée quand c’est encore elle', async () => {
    const { enqueue, dequeue, getPending } = await freshModule();
    const rev = await enqueue('d1', validData);
    await dequeue('d1', rev);

    expect(await getPending('d1')).toBeNull();
  });

  it('flushAll ne lance qu’un passage à la fois', async () => {
    const { enqueue, flushAll } = await freshModule();
    await enqueue('d1', validData);
    const upload = vi.fn(() => Promise.resolve());

    await Promise.all([flushAll(upload), flushAll(upload)]);

    expect(upload).toHaveBeenCalledTimes(1);
  });
});
