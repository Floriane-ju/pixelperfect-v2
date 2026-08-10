import { useCallback, useRef, useState } from 'react';
import type { TouchEvent, UIEvent, WheelEvent } from 'react';

/** Défilement (px) à partir duquel le header passe en mode réduit. */
const SCROLL_COMPACT_THRESHOLD = 24;

/**
 * Marge de défilement restante (px) exigée pour ré-agrandir le header : légèrement au-dessus
 * de la hauteur libérée par la réduction (~166 px : titre 2 lignes → 1 ligne + paddings).
 * En dessous, ré-agrandir supprimerait le débordement, `scrollTop` retomberait à 0 et le
 * header oscillerait entre les deux tailles.
 */
const SCROLL_EXPAND_MIN_OVERFLOW = 200;

/** Distance (px) d'un glissement vers le bas rétablissant le header quand la liste est en haut. */
const TOUCH_EXPAND_DISTANCE = 8;

export interface UseCompactHeaderOnScrollReturn {
  /** `true` quand le header doit être affiché en version réduite. */
  isScrolled: boolean;
  /** À étaler sur le conteneur défilant. */
  contentScrollProps: {
    onScroll: (e: UIEvent<HTMLDivElement>) => void;
    onWheel: (e: WheelEvent<HTMLDivElement>) => void;
    onTouchStart: (e: TouchEvent<HTMLDivElement>) => void;
    onTouchMove: (e: TouchEvent<HTMLDivElement>) => void;
  };
}

/**
 * Réduit le header de la galerie au défilement, avec hystérésis.
 *
 * Une fois réduit, le header ne revient à sa taille pleine qu'en haut de liste et si la grille
 * garde assez de débordement pour rester scrollable une fois ré-agrandie — sinon `scrollTop`
 * retomberait à 0 et le header oscillerait. En deçà de cette marge, seul un geste explicite
 * vers le haut le rétablit : à `scrollTop` 0 le navigateur n'émet plus d'événement `scroll`,
 * la molette et le toucher sont donc les seuls signaux disponibles.
 */
export function useCompactHeaderOnScroll(): UseCompactHeaderOnScrollReturn {
  const [isScrolled, setIsScrolled] = useState(false);
  const touchStartY = useRef(0);

  const expandIfAtTop = useCallback((el: HTMLDivElement) => {
    if (el.scrollTop === 0) setIsScrolled(false);
  }, []);

  const onScroll = useCallback((e: UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const overflow = el.scrollHeight - el.clientHeight;
    setIsScrolled((prev) =>
      prev
        ? !(el.scrollTop === 0 && overflow > SCROLL_EXPAND_MIN_OVERFLOW)
        : el.scrollTop > SCROLL_COMPACT_THRESHOLD
    );
  }, []);

  const onWheel = useCallback(
    (e: WheelEvent<HTMLDivElement>) => {
      if (e.deltaY < 0) expandIfAtTop(e.currentTarget);
    },
    [expandIfAtTop]
  );

  const onTouchStart = useCallback((e: TouchEvent<HTMLDivElement>) => {
    touchStartY.current = e.touches[0]?.clientY ?? 0;
  }, []);

  const onTouchMove = useCallback(
    (e: TouchEvent<HTMLDivElement>) => {
      const y = e.touches[0]?.clientY;
      if (y !== undefined && y - touchStartY.current > TOUCH_EXPAND_DISTANCE) {
        expandIfAtTop(e.currentTarget);
      }
    },
    [expandIfAtTop]
  );

  return {
    isScrolled,
    contentScrollProps: { onScroll, onWheel, onTouchStart, onTouchMove },
  };
}
