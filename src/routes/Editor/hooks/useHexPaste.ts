import { useEffect } from 'react';
import type { HexColor } from '@/types';

const PASTED_HEX_RE = /^([0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

/**
 * Couleur collée → forme canonique #rrggbb minuscule (comme le sélecteur) : exports PNG/SVG et pot
 * de peinture ne lisent que 6 chiffres et comparent les chaînes. L'alpha éventuel est ignoré.
 */
export function parsePastedHex(text: string): HexColor | null {
  const raw = text.trim().replace(/^#/, '');
  if (!PASTED_HEX_RE.test(raw)) return null;
  const rgb = raw.length <= 4 ? raw.slice(0, 3).replace(/./g, c => c + c) : raw.slice(0, 6);
  return `#${rgb.toLowerCase()}` as HexColor;
}

/** Coller une couleur hex hors d'un champ de saisie la sélectionne. */
export function useHexPaste(onColor: (hex: HexColor) => void): void {
  useEffect(() => {
    const handler = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
      const hex = parsePastedHex(e.clipboardData?.getData('text') ?? '');
      if (!hex) return;
      e.preventDefault();
      onColor(hex);
    };
    document.addEventListener('paste', handler);
    return () => document.removeEventListener('paste', handler);
  }, [onColor]);
}
