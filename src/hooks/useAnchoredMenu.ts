import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { useOutsideDismiss } from './useOutsideDismiss';

const MENU_GAP = 4;

export interface AnchoredPosition {
  top: number;
  left: number;
}

export interface UseAnchoredMenuParams {
  open: boolean;
  onDismiss: () => void;
  /** Largeur supposée avant la première mesure du menu (évite un saut au premier rendu). */
  fallbackWidth: number;
}

export interface UseAnchoredMenuReturn {
  /** À poser sur le conteneur du déclencheur. */
  rootRef: RefObject<HTMLDivElement>;
  /** À poser sur le menu (rendu en portal). */
  menuRef: RefObject<HTMLUListElement>;
  /** `null` tant que la position n'est pas mesurée : ne pas rendre le menu avant. */
  position: AnchoredPosition | null;
}

/**
 * Positionne un menu porté en portal sous son déclencheur, le recale au resize/scroll
 * et le ferme au clic extérieur ou à Escape.
 */
export function useAnchoredMenu({
  open,
  onDismiss,
  fallbackWidth,
}: UseAnchoredMenuParams): UseAnchoredMenuReturn {
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);
  const [position, setPosition] = useState<AnchoredPosition | null>(null);

  const updatePosition = useCallback(() => {
    const root = rootRef.current;
    if (!root) return;
    const width = menuRef.current?.offsetWidth ?? fallbackWidth;
    const rect = root.getBoundingClientRect();
    const left = Math.max(
      MENU_GAP,
      Math.min(rect.right - width, window.innerWidth - width - MENU_GAP),
    );
    setPosition({ top: rect.bottom + MENU_GAP, left });
  }, [fallbackWidth]);

  useLayoutEffect(() => {
    if (open) updatePosition();
  }, [open, updatePosition]);

  useOutsideDismiss({ active: open, refs: [rootRef, menuRef], onDismiss, closeOnEscape: true });

  useEffect(() => {
    if (!open) return;
    const handleReposition = () => updatePosition();
    window.addEventListener('resize', handleReposition);
    window.addEventListener('scroll', handleReposition, true);
    return () => {
      window.removeEventListener('resize', handleReposition);
      window.removeEventListener('scroll', handleReposition, true);
    };
  }, [open, updatePosition]);

  return { rootRef, menuRef, position };
}
