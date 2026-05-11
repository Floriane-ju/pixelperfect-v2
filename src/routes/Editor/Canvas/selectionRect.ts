import type { SelectionState } from '@/routes/Editor/hooks/useSelection';

export interface SelectionRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function computeSelectionRect(state: SelectionState | undefined): SelectionRect | null {
  if (!state) return null;
  if (state.kind === 'defining') {
    const x = Math.min(state.start.x, state.end.x);
    const y = Math.min(state.start.y, state.end.y);
    const w = Math.abs(state.end.x - state.start.x) + 1;
    const h = Math.abs(state.end.y - state.start.y) + 1;
    return { x, y, w, h };
  }
  if (state.kind === 'floating') return { x: state.originX, y: state.originY, w: state.w, h: state.h };
  return null;
}
