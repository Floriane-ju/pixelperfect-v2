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
  };
}

/** Modale flottante : cascade initiale, glissement par l'en-tête et remontée au premier plan. */
export function useDraggableModal(): UseDraggableModalReturn {
  const { zIndex, raise, initialOffset } = useModalZIndex();
  const [offset, setOffset] = useState(initialOffset);
  const drag = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null);

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
        drag.current = { sx: e.clientX, sy: e.clientY, ox: offset.x, oy: offset.y };
      },
      onPointerMove: (e) => {
        if (!drag.current) return;
        setOffset({
          x: drag.current.ox + e.clientX - drag.current.sx,
          y: drag.current.oy + e.clientY - drag.current.sy,
        });
      },
      onPointerUp: () => {
        drag.current = null;
      },
    },
  };
}
