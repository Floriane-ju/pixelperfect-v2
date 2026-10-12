import { useCallback, useRef, useState } from 'react';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import type { DrawingData, DrawingRow } from '@/types';

const MAX_HISTORY = 50;
// Budget total de pixels stockés dans l'historique : 50 snapshots d'un 512×512 dense dépassent
// 1 Go et font crasher iOS Safari.
const MAX_HISTORY_PIXELS = 2_000_000;

const pixelCounts = new WeakMap<object, number>();

function sizeOf(pixels: Record<string, unknown>): number {
  const cached = pixelCounts.get(pixels);
  if (cached !== undefined) return cached;
  const n = Object.keys(pixels).length;
  pixelCounts.set(pixels, n);
  return n;
}

/**
 * Pixels réellement en mémoire : les snapshots partagent les calques non modifiés (même objet
 * `pixels`), qui ne sont comptés qu'une fois.
 */
function storedPixels(snapshots: DrawingData[]): number {
  const seen = new Set<object>();
  let total = 0;
  for (const snapshot of snapshots) {
    for (const layer of snapshot.layers) {
      if (seen.has(layer.pixels)) continue;
      seen.add(layer.pixels);
      total += sizeOf(layer.pixels);
    }
  }
  return total;
}

/** Garde au plus MAX_HISTORY entrées et MAX_HISTORY_PIXELS pixels, en supprimant les plus anciennes. */
export function trimHistory(past: DrawingData[], budget = MAX_HISTORY_PIXELS): DrawingData[] {
  const recent = past.length > MAX_HISTORY ? past.slice(past.length - MAX_HISTORY) : past;
  let start = 0;
  // Le snapshot le plus récent est toujours conservé, même s'il dépasse seul le budget.
  // ponytail: recalcul O(n²) sur ≤ 50 snapshots, négligeable devant un trait.
  while (recent.length - start > 1 && storedPixels(recent.slice(start)) > budget) start++;
  return start === 0 ? recent : recent.slice(start);
}

interface UseUndoRedoParams {
  latestDataRef: MutableRefObject<DrawingData | null>;
  setDrawing: Dispatch<SetStateAction<DrawingRow | null>>;
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
    pastRef.current = trimHistory([...pastRef.current, before]);
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
    // Les réglages d'affichage ne font pas partie de l'historique : on garde ceux du moment.
    setDrawing(prev => prev ? { ...prev, data: { ...before, settings: prev.data.settings } } : prev);
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
    setDrawing(prev => prev ? { ...prev, data: { ...after, settings: prev.data.settings } } : prev);
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
