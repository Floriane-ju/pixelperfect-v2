import { useContext, useRef } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { SnackbarContext } from '@/components/Snackbar/SnackbarContext';

const LONG_PRESS_MS = 500;
const MOVE_TOLERANCE_SQ = 100;

export interface LongPressLabelHandlers {
  onPointerDown?: (e: ReactPointerEvent<HTMLButtonElement>) => void;
  onPointerUp?: (e: ReactPointerEvent<HTMLButtonElement>) => void;
  onPointerCancel?: (e: ReactPointerEvent<HTMLButtonElement>) => void;
  onPointerLeave?: (e: ReactPointerEvent<HTMLButtonElement>) => void;
  onPointerMove?: (e: ReactPointerEvent<HTMLButtonElement>) => void;
}

export interface LongPressLabelApi {
  handlers: LongPressLabelHandlers;
  consumeFired: () => boolean;
}

export function useLongPressLabel(label: string | undefined, enabled: boolean): LongPressLabelApi {
  const snackbar = useContext(SnackbarContext);
  const timerRef = useRef<number | null>(null);
  const firedRef = useRef(false);
  const startRef = useRef<{ x: number; y: number } | null>(null);

  const consumeFired = () => {
    const v = firedRef.current;
    firedRef.current = false;
    return v;
  };

  if (!enabled || !label || !snackbar) {
    return { handlers: {}, consumeFired };
  }

  const clear = () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    startRef.current = null;
  };

  return {
    handlers: {
      onPointerDown: e => {
        if (e.pointerType === 'mouse') return;
        firedRef.current = false;
        startRef.current = { x: e.clientX, y: e.clientY };
        clear();
        timerRef.current = window.setTimeout(() => {
          snackbar.show(label);
          firedRef.current = true;
          timerRef.current = null;
        }, LONG_PRESS_MS);
      },
      onPointerMove: e => {
        if (!startRef.current) return;
        const dx = e.clientX - startRef.current.x;
        const dy = e.clientY - startRef.current.y;
        if (dx * dx + dy * dy > MOVE_TOLERANCE_SQ) clear();
      },
      onPointerUp: () => clear(),
      onPointerCancel: () => clear(),
      onPointerLeave: () => clear(),
    },
    consumeFired,
  };
}
