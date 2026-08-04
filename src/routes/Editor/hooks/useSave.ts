import { useCallback, useEffect, useRef } from 'react';
import { updateDrawingData } from '@/lib/drawings';
import { updateDrawingData as localUpdateDrawingData } from '@/lib/localLibrary';
import { enqueue, dequeue, getPending } from '@/lib/offlineQueue';
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
    const pending = await getPending(id);
    if (!pending) return;
    try {
      await updateDrawingData(id, pending);
      await dequeue(id);
      setStatus('ready');
    } catch {
      // still offline — keep in queue
    }
  }, [id, authed, setStatus]);

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
    return () => {
      if (saveTimerRef.current !== null && latestDataRef.current && currentId) {
        clearTimeout(saveTimerRef.current);
        const data = latestDataRef.current;
        if (currentAuthed) {
          updateDrawingData(currentId, data).catch(() => {
            void enqueue(currentId, data);
          });
        } else {
          void localUpdateDrawingData(currentId, data);
        }
      }
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
      try {
        await updateDrawingData(id, data);
        await dequeue(id);
        setStatus('ready');
      } catch {
        await enqueue(id, data);
        setStatus('error');
      }
    }, SAVE_DELAY);
  }, [id, authed, setStatus]);

  return { scheduleSave, latestDataRef };
}
