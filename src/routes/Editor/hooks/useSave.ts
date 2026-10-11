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

export function useSave({ id, drawing, authed, setStatus }: UseSaveParams) {
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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
        if (currentAuthed) {
          // File d'abord, en parallèle de l'envoi : le .catch d'un fetch coupé par la suspension
          // iOS n'aurait jamais le temps de s'exécuter.
          const rev = enqueue(currentId, data);
          updateDrawingData(currentId, data)
            .then(async () => dequeue(currentId, await rev))
            .catch(() => undefined);
        } else {
          localUpdateDrawingData(currentId, data).catch(() => undefined);
        }
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
  }, [id, authed]);

  const scheduleSave = useCallback(() => {
    if (!id) return;
    if (saveTimerRef.current !== null) clearTimeout(saveTimerRef.current);
    setStatus('saving');
    saveTimerRef.current = setTimeout(async () => {
      saveTimerRef.current = null;
      const data = latestDataRef.current;
      if (!data) return;
      if (!authed) {
        try {
          await localUpdateDrawingData(id, data);
          setStatus('ready');
        } catch {
          setStatus('error');
        }
        return;
      }
      // Écriture anticipée dans la file : une sauvegarde en vol au moment où iOS suspend la PWA
      // n'est pas perdue. Retirée seulement si personne ne l'a remplacée entre-temps.
      const rev = await enqueue(id, data);
      try {
        await updateDrawingData(id, data);
        await dequeue(id, rev);
        setStatus('ready');
      } catch (err) {
        // Refus définitif : inutile de garder en file une écriture qui sera toujours rejetée.
        if (err instanceof SaveRejectedError) await dequeue(id, rev);
        setStatus('error');
      }
    }, SAVE_DELAY);
  }, [id, authed, setStatus]);

  return { scheduleSave, latestDataRef };
}
