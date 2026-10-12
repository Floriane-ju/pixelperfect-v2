import { useEffect, useEffectEvent } from 'react';
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
  // Lus au moment de l'événement : refs et onDismiss recréés à chaque render ne relancent pas l'effet.
  const handlePointerDown = useEffectEvent((e: PointerEvent) => {
    const target = e.target as Node;
    if (refs.some((ref) => ref.current?.contains(target))) return;
    onDismiss();
  });
  const handleKeyDown = useEffectEvent((e: KeyboardEvent) => {
    if (e.key !== 'Escape') return;
    // Signale aux modales (listener window, plus tard dans la propagation) que la touche est prise.
    e.preventDefault();
    onDismiss();
  });

  useEffect(() => {
    if (!active) return;
    // Enveloppes locales : l'identité d'une fonction useEffectEvent n'est pas garantie stable.
    const onPointerDown = (e: PointerEvent) => handlePointerDown(e);
    const onKeyDown = (e: KeyboardEvent) => handleKeyDown(e);
    document.addEventListener('pointerdown', onPointerDown);
    if (closeOnEscape) document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      if (closeOnEscape) document.removeEventListener('keydown', onKeyDown);
    };
  }, [active, closeOnEscape]);
}
