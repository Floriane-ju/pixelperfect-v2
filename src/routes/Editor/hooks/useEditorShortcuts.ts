import { useEffect } from 'react';
import type { Tool } from '../Canvas/Canvas';
import type { UseSelectionApi } from './useSelection';

interface UseEditorShortcutsParams {
  handleUndo: () => void;
  handleRedo: () => void;
  setTool: (t: Tool) => void;
  selectionRef: React.MutableRefObject<UseSelectionApi>;
}

export function useEditorShortcuts({ handleUndo, handleRedo, setTool, selectionRef }: UseEditorShortcutsParams): void {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const inText =
        !!target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);

      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
        return;
      }
      if (
        ((e.ctrlKey || e.metaKey) && e.key === 'y') ||
        ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'z')
      ) {
        e.preventDefault();
        handleRedo();
        return;
      }
      if (inText) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      if (e.key === 's' || e.key === 'S') {
        e.preventDefault();
        setTool('select');
        return;
      }
      if (e.key === 'Escape') {
        const sel = selectionRef.current;
        if (sel.state.kind !== 'idle') {
          e.preventDefault();
          sel.cancel();
        }
        return;
      }
      if (e.key === 'Enter') {
        const sel = selectionRef.current;
        if (sel.hasFloating) {
          e.preventDefault();
          sel.commit();
        }
        return;
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [handleUndo, handleRedo, setTool, selectionRef]);
}
