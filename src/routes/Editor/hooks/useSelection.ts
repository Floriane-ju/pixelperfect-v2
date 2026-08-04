import { useCallback, useRef, useState } from 'react';
import type { MutableRefObject } from 'react';
import type { DrawingData, HexColor } from '@/types';

export type SelectionState =
  | { kind: 'idle' }
  | { kind: 'defining'; start: { x: number; y: number }; end: { x: number; y: number } }
  | {
      kind: 'floating';
      w: number;
      h: number;
      pixels: Record<string, HexColor>;
      originX: number;
      originY: number;
    };

interface UseSelectionParams {
  data: DrawingData;
  activeLayerId: string;
  onLayerChange: (layerId: string, pixels: Record<string, HexColor>) => void;
  pushHistory: (before: DrawingData) => void;
  latestDataRef: MutableRefObject<DrawingData | null>;
}

export interface UseSelectionApi {
  state: SelectionState;
  hasFloating: boolean;
  startDefining: (px: { x: number; y: number }) => void;
  updateDefining: (px: { x: number; y: number }) => void;
  finishDefining: () => void;
  startMove: (px: { x: number; y: number }) => boolean;
  moveTo: (px: { x: number; y: number }) => void;
  endMove: () => void;
  commit: () => void;
  cancel: () => void;
  isInsideFloating: (px: { x: number; y: number }) => boolean;
}

function normalizeRect(a: { x: number; y: number }, b: { x: number; y: number }) {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return { x, y, w: Math.abs(b.x - a.x) + 1, h: Math.abs(b.y - a.y) + 1 };
}

export function useSelection({
  data,
  activeLayerId,
  onLayerChange,
  pushHistory,
  latestDataRef,
}: UseSelectionParams): UseSelectionApi {
  const [state, setState] = useState<SelectionState>({ kind: 'idle' });
  const beforeRef = useRef<DrawingData | null>(null);
  const layerPixelsAfterLiftRef = useRef<Record<string, HexColor>>({});
  const dragRef = useRef<{ startPx: { x: number; y: number }; originX: number; originY: number } | null>(null);

  const clamp = useCallback(
    (px: { x: number; y: number }) => ({
      x: Math.max(0, Math.min(data.width - 1, px.x)),
      y: Math.max(0, Math.min(data.height - 1, px.y)),
    }),
    [data.width, data.height],
  );

  const startDefining = useCallback(
    (px: { x: number; y: number }) => {
      const c = clamp(px);
      setState({ kind: 'defining', start: c, end: c });
    },
    [clamp],
  );

  const updateDefining = useCallback(
    (px: { x: number; y: number }) => {
      const c = clamp(px);
      setState(prev => (prev.kind === 'defining' ? { kind: 'defining', start: prev.start, end: c } : prev));
    },
    [clamp],
  );

  const finishDefining = useCallback(() => {
    if (state.kind !== 'defining') return;
    const rect = normalizeRect(state.start, state.end);
    const layer = data.layers.find(l => l.id === activeLayerId);
    if (!layer) {
      setState({ kind: 'idle' });
      return;
    }
    const liftedPixels: Record<string, HexColor> = {};
    const remainingPixels: Record<string, HexColor> = { ...layer.pixels };
    let lifted = 0;
    for (let dy = 0; dy < rect.h; dy++) {
      for (let dx = 0; dx < rect.w; dx++) {
        const cx = rect.x + dx;
        const cy = rect.y + dy;
        if (cx < 0 || cy < 0 || cx >= data.width || cy >= data.height) continue;
        const key = `${cx},${cy}`;
        const c = remainingPixels[key];
        if (c !== undefined) {
          liftedPixels[`${dx},${dy}`] = c;
          delete remainingPixels[key];
          lifted++;
        }
      }
    }
    if (lifted === 0) {
      setState({ kind: 'idle' });
      return;
    }
    beforeRef.current = latestDataRef.current;
    layerPixelsAfterLiftRef.current = remainingPixels;
    onLayerChange(activeLayerId, remainingPixels);
    setState({
      kind: 'floating',
      w: rect.w,
      h: rect.h,
      pixels: liftedPixels,
      originX: rect.x,
      originY: rect.y,
    });
  }, [state, data, activeLayerId, latestDataRef, onLayerChange]);

  const isInsideFloating = useCallback(
    (px: { x: number; y: number }) => {
      if (state.kind !== 'floating') return false;
      return (
        px.x >= state.originX &&
        px.x < state.originX + state.w &&
        px.y >= state.originY &&
        px.y < state.originY + state.h
      );
    },
    [state],
  );

  const startMove = useCallback(
    (px: { x: number; y: number }) => {
      if (state.kind !== 'floating') return false;
      dragRef.current = { startPx: px, originX: state.originX, originY: state.originY };
      return true;
    },
    [state],
  );

  const moveTo = useCallback((px: { x: number; y: number }) => {
    const drag = dragRef.current;
    if (!drag) return;
    setState(prev => {
      if (prev.kind !== 'floating') return prev;
      const dx = px.x - drag.startPx.x;
      const dy = px.y - drag.startPx.y;
      return { ...prev, originX: drag.originX + dx, originY: drag.originY + dy };
    });
  }, []);

  const endMove = useCallback(() => {
    dragRef.current = null;
  }, []);

  const commit = useCallback(() => {
    if (state.kind === 'idle') return;
    if (state.kind === 'defining') {
      setState({ kind: 'idle' });
      return;
    }
    const base = layerPixelsAfterLiftRef.current;
    const merged: Record<string, HexColor> = { ...base };
    for (const [k, c] of Object.entries(state.pixels)) {
      const comma = k.indexOf(',');
      const dx = parseInt(k.slice(0, comma), 10);
      const dy = parseInt(k.slice(comma + 1), 10);
      const cx = state.originX + dx;
      const cy = state.originY + dy;
      if (cx < 0 || cy < 0 || cx >= data.width || cy >= data.height) continue;
      merged[`${cx},${cy}`] = c;
    }
    if (beforeRef.current) pushHistory(beforeRef.current);
    onLayerChange(activeLayerId, merged);
    beforeRef.current = null;
    layerPixelsAfterLiftRef.current = {};
    dragRef.current = null;
    setState({ kind: 'idle' });
  }, [state, data.width, data.height, activeLayerId, onLayerChange, pushHistory]);

  const cancel = useCallback(() => {
    if (state.kind === 'idle') return;
    if (state.kind === 'floating') {
      const before = beforeRef.current;
      if (before) {
        const origLayer = before.layers.find(l => l.id === activeLayerId);
        if (origLayer) onLayerChange(activeLayerId, origLayer.pixels);
      }
    }
    beforeRef.current = null;
    layerPixelsAfterLiftRef.current = {};
    dragRef.current = null;
    setState({ kind: 'idle' });
  }, [state, activeLayerId, onLayerChange]);

  return {
    state,
    hasFloating: state.kind === 'floating',
    startDefining,
    updateDefining,
    finishDefining,
    startMove,
    moveTo,
    endMove,
    commit,
    cancel,
    isInsideFloating,
  };
}
