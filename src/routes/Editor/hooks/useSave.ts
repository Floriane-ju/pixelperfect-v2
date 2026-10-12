import { useCallback, useEffect, useRef } from 'react';
import { updateDrawingData } from '@/lib/drawings';
import { updateDrawingData as localUpdateDrawingData } from '@/lib/localLibrary';
import { SaveRejectedError } from '@/lib/saveErrors';
import { enqueue, dequeue, getPendingEntry, holdForEditor, replay } from '@/lib/offlineQueue';
import type { DrawingData, DrawingRow } from '@/types';

const SAVE_DELAY = 1500;

type Status = 'loading' | 'ready' | 'error' | 'saving';

interface UseSaveParams {
  id: string | undefined;
  drawing: DrawingRow | null;
  authed: boolean;
  setStatus: (s: Status) => void;
}

/** Écrit le dessin ; renvoie false en cas d'échec (l'entrée reste en file si l'erreur est transitoire). */
async function persist(id: string, data: DrawingData, authed: boolean): Promise<boolean> {
  if (!authed) {
    try {
      await localUpdateDrawingData(id, data);
      return true;
    } catch {
      return false;
    }
  }
  // Écriture anticipée dans la file : une sauvegarde en vol au moment où iOS suspend la PWA
  // n'est pas perdue. Retirée seulement si personne ne l'a remplacée entre-temps.
  const rev = await enqueue(id, data);
  try {
    await updateDrawingData(id, data);
    await dequeue(id, rev);
    return true;
  } catch (err) {
    // Refus définitif : inutile de garder en file une écriture qui sera toujours rejetée.
    if (err instanceof SaveRejectedError) await dequeue(id, rev);
    return false;
  }
}

export function useSave({ id, drawing, authed, setStatus }: UseSaveParams) {
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlightRef = useRef<Promise<void>>(Promise.resolve());
  const saveSeqRef = useRef(0);
  const latestDataRef = useRef<DrawingData | null>(null);

  useEffect(() => {
    if (drawing) latestDataRef.current = drawing.data;
  }, [drawing]);

  // File offline = persistance distante uniquement ; en local, l'écriture IndexedDB
  // est déjà « hors-ligne » et ne nécessite ni file ni re-sync.
  const flushPending = useCallback(async () => {
    if (!id || !authed) return;
    const entry = await getPendingEntry(id);
    if (entry && await replay(id, entry, updateDrawingData)) setStatus('ready');
  }, [id, authed, setStatus]);

  // Tant que le dessin est ouvert, sa file est gérée ici : flushAll (SessionProvider) ne doit pas
  // renvoyer en parallèle une entrée plus ancienne qui écraserait une sauvegarde en cours.
  useEffect(() => {
    if (!id || !authed) return;
    return holdForEditor(id);
  }, [id, authed]);

  useEffect(() => {
    if (navigator.onLine) void flushPending();
  }, [flushPending]);

  useEffect(() => {
    window.addEventListener('online', flushPending);
    return () => window.removeEventListener('online', flushPending);
  }, [flushPending]);

  useEffect(() => {
    const currentId = id;
    const currentAuthed = authed;
    // iOS suspend/tue la PWA sans démonter React (pas de cleanup) : pagehide et
    // visibilitychange sont les seuls signaux fiables avant la coupure. beforeunload
    // n'est pas fiable sur iOS Safari.
    const flushImmediate = () => {
      if (saveTimerRef.current !== null && latestDataRef.current && currentId) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
        const data = latestDataRef.current;
        const seq = ++saveSeqRef.current;
        // File d'abord, tout de suite : la suite peut attendre un envoi en vol, et le .catch d'un
        // fetch coupé par la suspension iOS n'aurait jamais le temps de s'exécuter.
        const rev = currentAuthed ? enqueue(currentId, data) : null;
        // Même chaîne que scheduleSave : un envoi plus ancien encore en vol ne doit pas arriver après.
        inFlightRef.current = inFlightRef.current.then(async () => {
          let ok = true;
          try {
            if (rev) {
              await updateDrawingData(currentId, data);
              await dequeue(currentId, await rev);
            } else {
              await localUpdateDrawingData(currentId, data);
            }
          } catch {
            ok = false;
          }
          if (seq === saveSeqRef.current) setStatus(ok ? 'ready' : 'error');
        });
      }
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') flushImmediate();
    };
    window.addEventListener('pagehide', flushImmediate);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.removeEventListener('pagehide', flushImmediate);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      flushImmediate();
    };
  }, [id, authed, setStatus]);

  const scheduleSave = useCallback(() => {
    if (!id) return;
    if (saveTimerRef.current !== null) clearTimeout(saveTimerRef.current);
    setStatus('saving');
    saveTimerRef.current = setTimeout(() => {
      saveTimerRef.current = null;
      const data = latestDataRef.current;
      if (!data) return;
      // Envois en série : un envoi lent (> SAVE_DELAY) arrivant après le suivant écraserait
      // côté serveur une version plus récente.
      const seq = ++saveSeqRef.current;
      inFlightRef.current = inFlightRef.current.then(async () => {
        const ok = await persist(id, data, authed);
        // Une sauvegarde plus récente est programmée ou en attente : le badge reste sur « Enregistrement… ».
        if (seq === saveSeqRef.current && saveTimerRef.current === null) setStatus(ok ? 'ready' : 'error');
      });
    }, SAVE_DELAY);
  }, [id, authed, setStatus]);

  return { scheduleSave, latestDataRef };
}
