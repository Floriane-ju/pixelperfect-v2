import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';

export interface UseOutsideDismissParams {
  /** Le listener n'est branché que quand le panneau est ouvert. */
  active: boolean;
  /** Zones considérées comme « intérieures » (déclencheur, panneau porté en portal…). */
  refs: RefObject<HTMLElement | null>[];
  onDismiss: () => void;
  closeOnEscape?: boolean;
}

/**
 * Ferme un panneau/menu au pointerdown en dehors des zones fournies (et à Escape si demandé).
 * Pointer Events uniquement : un seul chemin pour souris, stylet et tactile.
 */
export function useOutsideDismiss({
  active,
  refs,
  onDismiss,
  closeOnEscape = false,
}: UseOutsideDismissParams): void {
  // Les refs sont recréées à chaque render : on les lit au moment de l'événement
  // pour garder l'effet stable.
  const refsRef = useRef(refs);
  refsRef.current = refs;

  useEffect(() => {
    if (!active) return;
    const handlePointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (refsRef.current.some((ref) => ref.current?.contains(target))) return;
      onDismiss();
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDismiss();
    };
    document.addEventListener('pointerdown', handlePointerDown);
    if (closeOnEscape) document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      if (closeOnEscape) document.removeEventListener('keydown', handleKeyDown);
    };
  }, [active, onDismiss, closeOnEscape]);
}
