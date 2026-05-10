import { useCallback, useEffect, useRef } from 'react';
import { updateDrawingData } from '@/lib/drawings';
import type { DrawingData, DrawingRow } from '@/types';

const SAVE_DELAY = 1500;
const QUEUE_PREFIX = 'pp_offline_';

type Status = 'loading' | 'ready' | 'error' | 'saving';

interface UseSaveParams {
  id: string | undefined;
  drawing: DrawingRow | null;
  setStatus: (s: Status) => void;
}

function queueKey(id: string) { return `${QUEUE_PREFIX}${id}`; }

function enqueue(id: string, data: DrawingData): void {
  try { localStorage.setItem(queueKey(id), JSON.stringify(data)); } catch { /* storage full */ }
}

function dequeue(id: string): void {
  localStorage.removeItem(queueKey(id));
}

function getPending(id: string): DrawingData | null {
  try {
    const raw = localStorage.getItem(queueKey(id));
    return raw ? (JSON.parse(raw) as DrawingData) : null;
  } catch {
    return null;
  }
}

export function useSave({ id, drawing, setStatus }: UseSaveParams) {
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestDataRef = useRef<DrawingData | null>(null);

  useEffect(() => {
    if (drawing) latestDataRef.current = drawing.data;
  }, [drawing]);

  const flushPending = useCallback(async () => {
    if (!id) return;
    const pending = getPending(id);
    if (!pending) return;
    try {
      await updateDrawingData(id, pending);
      dequeue(id);
      setStatus('ready');
    } catch {
      // still offline — keep in queue
    }
  }, [id, setStatus]);

  // Flush pending data on mount if online
  useEffect(() => {
    if (navigator.onLine) void flushPending();
  }, [flushPending]);

  // Retry on reconnect
  useEffect(() => {
    window.addEventListener('online', flushPending);
    return () => window.removeEventListener('online', flushPending);
  }, [flushPending]);

  // Flush pending timer on unmount
  useEffect(() => {
    const currentId = id;
    return () => {
      if (saveTimerRef.current !== null && latestDataRef.current && currentId) {
        clearTimeout(saveTimerRef.current);
        const data = latestDataRef.current;
        updateDrawingData(currentId, data).catch(() => { enqueue(currentId, data); });
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
        dequeue(id);
        setStatus('ready');
      } catch {
        enqueue(id, latestDataRef.current);
        setStatus('error');
      }
    }, SAVE_DELAY);
  }, [id, setStatus]);

  return { scheduleSave, latestDataRef };
}
