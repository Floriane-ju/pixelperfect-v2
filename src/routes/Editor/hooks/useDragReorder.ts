import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import type { MouseEvent, PointerEvent, RefObject } from 'react';

export type DropPosition = 'before' | 'after';

export interface DragState {
  id: string;
  targetId: string | null;
  pos: DropPosition;
}

export interface ItemSpan {
  id: string;
  start: number;
  end: number;
}

export interface DropTarget {
  targetId: string | null;
  pos: DropPosition;
}

/**
 * Élément survolé à la coordonnée `coord` le long de l'axe, en ignorant l'élément déplacé.
 * Avant le premier ou après le dernier : on borne à l'extrémité. `spans` dans l'ordre d'affichage.
 */
export function findDropTarget(spans: ItemSpan[], coord: number, draggedId: string): DropTarget {
  for (const { id, start, end } of spans) {
    if (id === draggedId) continue;
    if (coord >= start && coord <= end) {
      return { targetId: id, pos: coord < start + (end - start) / 2 ? 'before' : 'after' };
    }
  }
  const first = spans[0];
  const last = spans[spans.length - 1];
  if (first && coord < first.start) return { targetId: first.id, pos: 'before' };
  if (last && coord > last.end) return { targetId: last.id, pos: 'after' };
  return { targetId: null, pos: 'before' };
}

export interface DragHandleProps {
  onPointerDown: (e: PointerEvent<HTMLElement>) => void;
  onPointerMove: (e: PointerEvent<HTMLElement>) => void;
  onPointerUp: (e: PointerEvent<HTMLElement>) => void;
  onPointerCancel: (e: PointerEvent<HTMLElement>) => void;
  onClick: (e: MouseEvent<HTMLElement>) => void;
}

export interface UseDragReorderParams {
  axis: 'x' | 'y';
  /** `pos` est relative à l'ordre d'affichage. */
  onDrop: (fromId: string, toId: string, pos: DropPosition) => void;
}

export interface UseDragReorderReturn<T extends HTMLElement> {
  drag: DragState | null;
  itemRefs: RefObject<Map<string, T>>;
  setItemRef: (id: string) => (el: T | null) => void;
  handleProps: (id: string) => DragHandleProps;
}

/** Réordonnancement d'une liste par poignée (Pointer Events + capture) le long d'un axe. */
export function useDragReorder<T extends HTMLElement>({
  axis,
  onDrop,
}: UseDragReorderParams): UseDragReorderReturn<T> {
  const itemRefs = useRef<Map<string, T>>(new Map());
  const [drag, setDrag] = useState<DragState | null>(null);
  const dragRef = useRef<DragState | null>(null);
  useLayoutEffect(() => { dragRef.current = drag; });

  const setItemRef = useCallback((id: string) => (el: T | null) => {
    if (el) itemRefs.current.set(id, el);
    else itemRefs.current.delete(id);
  }, []);

  const handleMove = (e: PointerEvent<HTMLElement>) => {
    const current = dragRef.current;
    if (!current) return;
    const spans = Array.from(itemRefs.current.entries()).map(([id, el]) => {
      const r = el.getBoundingClientRect();
      return axis === 'x' ? { id, start: r.left, end: r.right } : { id, start: r.top, end: r.bottom };
    });
    const { targetId, pos } = findDropTarget(spans, axis === 'x' ? e.clientX : e.clientY, current.id);
    if (targetId !== current.targetId || pos !== current.pos) {
      setDrag({ id: current.id, targetId, pos });
    }
  };

  const handleEnd = (e: PointerEvent<HTMLElement>) => {
    const current = dragRef.current;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    setDrag(null);
    // Annulation système (rejet de paume, appel entrant…) : on n'applique pas le déplacement.
    if (e.type === 'pointercancel') return;
    if (!current || !current.targetId || current.targetId === current.id) return;
    onDrop(current.id, current.targetId, current.pos);
  };

  const handleProps = (id: string): DragHandleProps => ({
    onPointerDown: e => {
      e.stopPropagation();
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      setDrag({ id, targetId: null, pos: 'before' });
    },
    onPointerMove: handleMove,
    onPointerUp: handleEnd,
    onPointerCancel: handleEnd,
    onClick: e => e.stopPropagation(),
  });

  return { drag, itemRefs, setItemRef, handleProps };
}
