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
  /** À poser sur le conteneur du déclencheur (contient le trigger Button). */
  rootRef: RefObject<HTMLDivElement | null>;
  /** À poser sur le menu (rendu en portal). */
  menuRef: RefObject<HTMLUListElement | null>;
  /** `null` tant que la position n'est pas mesurée : ne pas rendre le menu avant. */
  position: AnchoredPosition | null;
}

/**
 * Positionne un menu porté en portal sous son déclencheur, le recale au resize/scroll,
 * le ferme au clic extérieur ou à Escape, et gère la navigation clavier (roving focus).
 *
 * Pattern menu ARIA :
 * - Focus déplacé au premier élément à l'ouverture
 * - ArrowUp/ArrowDown : navigation circulaire
 * - Home/End : premier/dernier élément
 * - Escape/Tab : ferme et rend le focus au déclencheur
 * - Les éléments de menu reçoivent tabIndex={-1} et sont gérés via roving focus
 */
export function useAnchoredMenu({
  open,
  onDismiss,
  fallbackWidth,
}: UseAnchoredMenuParams): UseAnchoredMenuReturn {
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);
  const [position, setPosition] = useState<AnchoredPosition | null>(null);
  const focusIndexRef = useRef<number>(-1);

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

  const getMenuItems = useCallback((): HTMLButtonElement[] => {
    const menu = menuRef.current;
    if (!menu) return [];
    return Array.from(menu.querySelectorAll('button[role="menuitem"]'));
  }, []);

  const getTrigger = useCallback((): HTMLButtonElement | null => {
    const root = rootRef.current;
    if (!root) return null;
    return root.querySelector('button[aria-haspopup="menu"]');
  }, []);

  const focusItem = useCallback((index: number) => {
    const items = getMenuItems();
    if (items.length === 0) return;
    const clampedIndex = ((index % items.length) + items.length) % items.length;
    items[clampedIndex]?.focus();
    focusIndexRef.current = clampedIndex;
  }, [getMenuItems]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const items = getMenuItems();
    if (items.length === 0) return;

    const currentIndex = focusIndexRef.current;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        focusItem((currentIndex + 1) % items.length);
        break;
      case 'ArrowUp':
        e.preventDefault();
        focusItem((currentIndex - 1 + items.length) % items.length);
        break;
      case 'Home':
        e.preventDefault();
        focusItem(0);
        break;
      case 'End':
        e.preventDefault();
        focusItem(items.length - 1);
        break;
      case 'Escape':
      case 'Tab':
        // Ferme et rend le focus au déclencheur. Sans ça le focus retomberait sur <body>
        // quand le menu est démonté, et la personne perdrait sa place dans la page.
        // Escape est aussi traité par `useOutsideDismiss`, mais lui ne restaure pas le focus.
        e.preventDefault();
        onDismiss();
        getTrigger()?.focus();
        break;
      default:
        break;
    }
  }, [getMenuItems, focusItem, onDismiss, getTrigger]);

  useLayoutEffect(() => {
    if (open) {
      updatePosition();
      // Défère la mise au focus au prochain tick pour que le menu soit rendu en portal
      requestAnimationFrame(() => {
        focusIndexRef.current = -1;
        const items = getMenuItems();
        if (items.length > 0) {
          items[0]?.focus();
          focusIndexRef.current = 0;
        }
      });
    }
  }, [open, updatePosition, getMenuItems]);

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

  useEffect(() => {
    if (!open) return;
    const menu = menuRef.current;
    if (!menu) return;
    menu.addEventListener('keydown', handleKeyDown);
    return () => menu.removeEventListener('keydown', handleKeyDown);
  }, [open, handleKeyDown]);

  return { rootRef, menuRef, position };
}
