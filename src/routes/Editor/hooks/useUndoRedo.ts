import { useCallback, useRef, useState } from 'react';
import type { DrawingData, DrawingRow } from '@/types';

const MAX_HISTORY = 50;

interface UseUndoRedoParams {
  latestDataRef: React.MutableRefObject<DrawingData | null>;
  setDrawing: React.Dispatch<React.SetStateAction<DrawingRow | null>>;
  scheduleSave: () => void;
}

export function useUndoRedo({ latestDataRef, setDrawing, scheduleSave }: UseUndoRedoParams) {
  const strokeSnapshotRef = useRef<DrawingData | null>(null);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const pastRef = useRef<DrawingData[]>([]);
  const futureRef = useRef<DrawingData[]>([]);

  const syncHistoryFlags = useCallback(() => {
    setCanUndo(pastRef.current.length > 0);
    setCanRedo(futureRef.current.length > 0);
  }, []);

  const pushHistory = useCallback((before: DrawingData) => {
    const past = pastRef.current;
    pastRef.current = past.length >= MAX_HISTORY ? [...past.slice(1), before] : [...past, before];
    futureRef.current = [];
    syncHistoryFlags();
  }, [syncHistoryFlags]);

  const handleDrawStart = useCallback(() => {
    strokeSnapshotRef.current = latestDataRef.current;
  }, [latestDataRef]);

  const handleDrawEnd = useCallback(() => {
    if (strokeSnapshotRef.current) {
      pushHistory(strokeSnapshotRef.current);
      strokeSnapshotRef.current = null;
    }
  }, [pushHistory]);

  const handleUndo = useCallback(() => {
    const past = pastRef.current;
    if (past.length === 0) return;
    const before = past[past.length - 1];
    if (!before) return;
    pastRef.current = past.slice(0, -1);
    const current = latestDataRef.current;
    if (current) futureRef.current = [...futureRef.current, current];
    setDrawing(prev => prev ? { ...prev, data: before } : prev);
    scheduleSave();
    syncHistoryFlags();
  }, [latestDataRef, scheduleSave, setDrawing, syncHistoryFlags]);

  const handleRedo = useCallback(() => {
    const future = futureRef.current;
    if (future.length === 0) return;
    const after = future[future.length - 1];
    if (!after) return;
    futureRef.current = future.slice(0, -1);
    const current = latestDataRef.current;
    if (current) pastRef.current = [...pastRef.current, current];
    setDrawing(prev => prev ? { ...prev, data: after } : prev);
    scheduleSave();
    syncHistoryFlags();
  }, [latestDataRef, scheduleSave, setDrawing, syncHistoryFlags]);

  return {
    canUndo,
    canRedo,
    pushHistory,
    handleDrawStart,
    handleDrawEnd,
    handleUndo,
    handleRedo,
  };
}
