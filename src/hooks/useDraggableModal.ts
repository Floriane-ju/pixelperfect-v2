import { useRef, useState } from 'react';
import type { CSSProperties, PointerEvent } from 'react';
import { useModalZIndex } from '@/lib/modalStack';

export interface UseDraggableModalReturn {
  zIndex: number;
  /** Style du panneau : décalage de glissement + empilement. */
  panelStyle: CSSProperties;
  /** À étaler sur le panneau pour le ramener au premier plan. */
  raiseHandlers: {
    onPointerDownCapture: () => void;
    onFocusCapture: () => void;
  };
  /** À étaler sur la poignée de glissement (l'en-tête). */
  dragHandlers: {
    onPointerDown: (e: PointerEvent<HTMLElement>) => void;
    onPointerMove: (e: PointerEvent<HTMLElement>) => void;
    onPointerUp: () => void;
    onPointerCancel: () => void;
    onLostPointerCapture: () => void;
  };
}

interface DragState {
  sx: number;
  sy: number;
  ox: number;
  oy: number;
  /** Bornes du décalage (depuis le départ) qui gardent l'en-tête dans la fenêtre. */
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);

/** Modale flottante : cascade initiale, glissement par l'en-tête et remontée au premier plan. */
export function useDraggableModal(): UseDraggableModalReturn {
  const { zIndex, raise, initialOffset } = useModalZIndex();
  const [offset, setOffset] = useState(initialOffset);
  const drag = useRef<DragState | null>(null);
  const endDrag = () => { drag.current = null; };

  return {
    zIndex,
    panelStyle: {
      transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))`,
      zIndex,
    },
    raiseHandlers: { onPointerDownCapture: raise, onFocusCapture: raise },
    dragHandlers: {
      onPointerDown: (e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        const rect = e.currentTarget.getBoundingClientRect();
        drag.current = {
          sx: e.clientX,
          sy: e.clientY,
          ox: offset.x,
          oy: offset.y,
          minX: -rect.left,
          maxX: window.innerWidth - rect.right,
          minY: -rect.top,
          maxY: window.innerHeight - rect.bottom,
        };
      },
      onPointerMove: (e) => {
        const d = drag.current;
        if (!d) return;
        setOffset({
          x: d.ox + clamp(e.clientX - d.sx, d.minX, d.maxX),
          y: d.oy + clamp(e.clientY - d.sy, d.minY, d.maxY),
        });
      },
      onPointerUp: endDrag,
      onPointerCancel: endDrag,
      onLostPointerCapture: endDrag,
    },
  };
}
