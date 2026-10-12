import { useEffect, useRef, useState } from 'react';
import type { FocusEvent, PointerEvent as ReactPointerEvent, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import styles from './Tooltip.module.scss';
import { cx } from '@/lib/cx';

const SHOW_DELAY_MS = 100;

export type TooltipPlacement = 'right' | 'left' | 'bottom' | 'top';

interface TooltipState {
  top: number;
  left: number;
  placement: TooltipPlacement;
}

export interface UseTooltipReturn {
  triggerProps: {
    onPointerEnter: (e: ReactPointerEvent<HTMLElement>) => void;
    onPointerLeave: () => void;
    onPointerDown: () => void;
    onFocus: (e: FocusEvent<HTMLElement>) => void;
    onBlur: () => void;
  };
  tooltip: ReactNode;
}

/** Bord extérieur du rail (dock, barre d'outils) qui contient le bouton, pour ne pas le chevaucher. */
function railEdge(target: HTMLElement, side: 'left' | 'right'): number {
  let edge = target.getBoundingClientRect()[side];
  for (let el = target.parentElement; el; el = el.parentElement) {
    const r = el.getBoundingClientRect();
    if (r.width > window.innerWidth / 2) break;
    edge = side === 'right' ? Math.max(edge, r.right) : Math.min(edge, r.left);
  }
  return edge;
}

/**
 * Côté qui ne recouvre pas les voisins : à droite d'un rail collé à gauche, à gauche d'un rail
 * collé à droite, sinon dessous (dessus si pas la place).
 */
function place(target: HTMLElement): TooltipState {
  const rect = target.getBoundingClientRect();
  if (rect.left < rect.width) {
    return { top: rect.top + rect.height / 2, left: railEdge(target, 'right'), placement: 'right' };
  }
  if (window.innerWidth - rect.right < rect.width) {
    return { top: rect.top + rect.height / 2, left: railEdge(target, 'left'), placement: 'left' };
  }
  const centerX = rect.left + rect.width / 2;
  if (window.innerHeight - rect.bottom < rect.height) {
    return { top: rect.top, left: centerX, placement: 'top' };
  }
  return { top: rect.bottom, left: centerX, placement: 'bottom' };
}

/** Infobulle au survol souris et au focus clavier. Le tactile garde l'appui long (`useLongPressLabel`). */
export function useTooltip(label: string | undefined, enabled: boolean): UseTooltipReturn {
  const [state, setState] = useState<TooltipState | null>(null);
  const timerRef = useRef<number | null>(null);

  const clearTimer = () => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = null;
  };

  const hide = () => {
    clearTimer();
    setState(null);
  };

  useEffect(() => clearTimer, []);

  useEffect(() => {
    if (!state) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setState(null);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [state]);

  const active = enabled && !!label;

  const triggerProps: UseTooltipReturn['triggerProps'] = {
    onPointerEnter: (e) => {
      if (!active || e.pointerType !== 'mouse') return;
      const target = e.currentTarget;
      clearTimer();
      timerRef.current = window.setTimeout(() => setState(place(target)), SHOW_DELAY_MS);
    },
    onPointerLeave: hide,
    onPointerDown: hide,
    onFocus: (e) => {
      if (active && e.currentTarget.matches(':focus-visible')) {
        setState(place(e.currentTarget));
      }
    },
    onBlur: hide,
  };

  const tooltip =
    active && state
      ? createPortal(
          <span
            aria-hidden="true"
            className={cx(styles.tooltip, styles[state.placement])}
            style={{ top: state.top, left: state.left }}
          >
            {label}
          </span>,
          document.body
        )
      : null;

  return { triggerProps, tooltip };
}
