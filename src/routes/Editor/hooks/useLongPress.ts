import { useCallback, useEffect, useRef, useState } from 'react';
import type { PointerEvent } from 'react';

export const LONG_PRESS_MS = 500;
/** Déplacement (px²) au-delà duquel l'appui n'est plus « long » mais un glissé. */
const MOVE_TOLERANCE_SQ = 100;

export interface UseLongPressParams {
  onLongPress: () => void;
  enabled?: boolean;
  delay?: number;
}

export interface UseLongPressReturn {
  /** Vrai pendant l'appui, avant le déclenchement (pour la barre de progression). */
  holding: boolean;
  handlers: {
    onPointerDown: (e: PointerEvent<HTMLElement>) => void;
    onPointerMove: (e: PointerEvent<HTMLElement>) => void;
    onPointerUp: () => void;
    onPointerLeave: () => void;
    onPointerCancel: () => void;
  };
  /** Vrai une seule fois après un déclenchement : le clic qui suit le relâchement est à ignorer. */
  consumeFired: () => boolean;
}

/** Appui long (souris, stylet, doigt) avec tolérance de mouvement. */
export function useLongPress({ onLongPress, enabled = true, delay = LONG_PRESS_MS }: UseLongPressParams): UseLongPressReturn {
  const [holding, setHolding] = useState(false);
  const timerRef = useRef<number | null>(null);
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const firedRef = useRef(false);
  const callbackRef = useRef(onLongPress);
  useEffect(() => { callbackRef.current = onLongPress; });

  const clear = useCallback(() => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = null;
    startRef.current = null;
    setHolding(false);
  }, []);

  useEffect(() => () => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
  }, []);

  const onPointerDown = useCallback((e: PointerEvent<HTMLElement>) => {
    if (!enabled || e.button !== 0) return;
    firedRef.current = false;
    clear();
    startRef.current = { x: e.clientX, y: e.clientY };
    setHolding(true);
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      firedRef.current = true;
      setHolding(false);
      callbackRef.current();
    }, delay);
  }, [enabled, delay, clear]);

  const onPointerMove = useCallback((e: PointerEvent<HTMLElement>) => {
    const start = startRef.current;
    if (!start) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    if (dx * dx + dy * dy > MOVE_TOLERANCE_SQ) clear();
  }, [clear]);

  const consumeFired = useCallback(() => {
    const fired = firedRef.current;
    firedRef.current = false;
    return fired;
  }, []);

  return {
    holding,
    handlers: { onPointerDown, onPointerMove, onPointerUp: clear, onPointerLeave: clear, onPointerCancel: clear },
    consumeFired,
  };
}
