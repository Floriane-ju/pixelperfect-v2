import { useEffect } from 'react';
import type { RefObject } from 'react';
import type { SelectionState } from '@/routes/Editor/hooks/useSelection';

interface UseSelectionPreviewParams {
  canvasRef: RefObject<HTMLCanvasElement>;
  state: SelectionState | undefined;
  dataWidth: number;
  dataHeight: number;
}

export function useSelectionPreview({ canvasRef, state, dataWidth, dataHeight }: UseSelectionPreviewParams): void {
  useEffect(() => {
    if (!state || state.kind !== 'floating') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, dataWidth, dataHeight);
    const { pixels, originX, originY } = state;
    for (const [k, c] of Object.entries(pixels)) {
      const comma = k.indexOf(',');
      const dx = parseInt(k.slice(0, comma), 10);
      const dy = parseInt(k.slice(comma + 1), 10);
      const cx = originX + dx;
      const cy = originY + dy;
      if (cx < 0 || cy < 0 || cx >= dataWidth || cy >= dataHeight) continue;
      ctx.fillStyle = c;
      ctx.fillRect(cx, cy, 1, 1);
    }
    return () => {
      ctx.clearRect(0, 0, dataWidth, dataHeight);
    };
  }, [canvasRef, state, dataWidth, dataHeight]);
}
