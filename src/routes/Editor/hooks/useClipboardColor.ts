import { useEffect } from 'react';
import type { HexColor } from '@/types';

interface UseClipboardColorParams {
  onColorChange: (color: HexColor) => void;
  commitRecentColor: (color: HexColor) => void;
}

export function useClipboardColor({ onColorChange, commitRecentColor }: UseClipboardColorParams): void {
  useEffect(() => {
    const handler = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
      const text = e.clipboardData?.getData('text') ?? '';
      const raw = text.trim().replace(/^#/, '');
      if (!/^([0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(raw)) return;
      e.preventDefault();
      const hex = `#${raw.toUpperCase()}` as HexColor;
      onColorChange(hex);
      commitRecentColor(hex);
    };
    document.addEventListener('paste', handler);
    return () => document.removeEventListener('paste', handler);
  }, [onColorChange, commitRecentColor]);
}
