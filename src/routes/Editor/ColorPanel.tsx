import { useLayoutEffect, useRef } from 'react';
import type { CSSProperties, ReactNode, RefObject } from 'react';
import { useModalA11y } from '@/hooks/useModalA11y';

/** Marge minimale entre le panneau ancré et les bords haut/bas de la fenêtre. */
const VIEWPORT_MARGIN = 8;

interface ColorPanelProps {
  children: ReactNode;
  onClose: () => void;
  className?: string;
  style?: CSSProperties;
  panelRef?: RefObject<HTMLDivElement | null>;
  /** Centre vertical souhaité (px, fenêtre) : le panneau y est centré puis gardé dans la fenêtre. */
  anchorY?: number;
}

export function ColorPanel({ children, onClose, className, style, panelRef, anchorY }: ColorPanelProps) {
  const localRef = useRef<HTMLDivElement>(null);
  const ref = panelRef ?? localRef;
  // Focus sur le panneau, pas sur le champ hex : sur iPad le focus d'un input ouvre le clavier.
  useModalA11y({ modalRef: ref, onClose, initialFocusRef: ref, closeOnEscape: false });

  useLayoutEffect(() => {
    const el = ref.current;
    if (anchorY === undefined || !el) return;
    const height = el.offsetHeight;
    const max = window.innerHeight - height - VIEWPORT_MARGIN;
    el.style.top = `${Math.max(VIEWPORT_MARGIN, Math.min(anchorY - height / 2, max))}px`;
  }, [anchorY, ref]);

  return (
    <div ref={ref} className={className} style={style} tabIndex={-1}>
      {children}
    </div>
  );
}
