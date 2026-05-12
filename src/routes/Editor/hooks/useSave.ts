import { useCallback, useEffect, useRef } from 'react';
import { updateDrawingData } from '@/lib/drawings';
import { enqueue, dequeue, getPending } from '@/lib/offlineQueue';
import type { DrawingData, DrawingRow } from '@/types';

const SAVE_DELAY = 1500;

type Status = 'loading' | 'ready' | 'error' | 'saving';

interface UseSaveParams {
  id: string | undefined;
  drawing: DrawingRow | null;
  setStatus: (s: Status) => void;
}

export function useSave({ id, drawing, setStatus }: UseSaveParams) {
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestDataRef = useRef<DrawingData | null>(null);

  useEffect(() => {
    if (drawing) latestDataRef.current = drawing.data;
  }, [drawing]);

  const flushPending = useCallback(async () => {
    if (!id) return;
    const pending = await getPending(id);
    if (!pending) return;
    try {
      await updateDrawingData(id, pending);
      await dequeue(id);
      setStatus('ready');
    } catch {
      // still offline — keep in queue
    }
  }, [id, setStatus]);

  useEffect(() => {
    if (navigator.onLine) void flushPending();
  }, [flushPending]);

  useEffect(() => {
    window.addEventListener('online', flushPending);
    return () => window.removeEventListener('online', flushPending);
  }, [flushPending]);

  useEffect(() => {
    const currentId = id;
    return () => {
      if (saveTimerRef.current !== null && latestDataRef.current && currentId) {
        clearTimeout(saveTimerRef.current);
        const data = latestDataRef.current;
        updateDrawingData(currentId, data).catch(() => { void enqueue(currentId, data); });
      }
    };
  }, [id]);

  const scheduleSave = useCallback(() => {
    if (!id) return;
    if (saveTimerRef.current !== null) clearTimeout(saveTimerRef.current);
    setStatus('saving');
    saveTimerRef.current = setTimeout(async () => {
      saveTimerRef.current = null;
      if (!latestDataRef.current) return;
      try {
        await updateDrawingData(id, latestDataRef.current);
        await dequeue(id);
        setStatus('ready');
      } catch {
        await enqueue(id, latestDataRef.current);
        setStatus('error');
      }
    }, SAVE_DELAY);
  }, [id, setStatus]);

  return { scheduleSave, latestDataRef };
}
