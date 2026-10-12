import { useEffect } from 'react';
import type { MutableRefObject } from 'react';
import type { Tool } from '../Canvas/Canvas';
import type { UseSelectionApi } from './useSelection';

const NON_TEXT_INPUTS = new Set(['range', 'checkbox', 'radio', 'button', 'color']);

interface UseEditorShortcutsParams {
  handleUndo: () => void;
  handleRedo: () => void;
  setTool: (t: Tool) => void;
  selectionRef: MutableRefObject<UseSelectionApi>;
  /** Lecture/pause de l'animation (Espace) — absent hors mode animation. */
  onPlayToggle?: () => void;
}

export function useEditorShortcuts({ handleUndo, handleRedo, setTool, selectionRef, onPlayToggle }: UseEditorShortcutsParams): void {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      // Seuls les champs de saisie gardent leurs touches : un slider (range) focalisé ne doit pas
      // bloquer undo/redo ni les raccourcis d'outils.
      const inText =
        (target instanceof HTMLInputElement && !NON_TEXT_INPUTS.has(target.type)) ||
        target instanceof HTMLTextAreaElement ||
        !!target?.isContentEditable;

      // Dans un champ (hex du sélecteur…), Cmd+Z reste l'undo natif du texte.
      if (inText) return;
      // Modale ouverte (confirmation…) : l'éditeur derrière ne doit réagir à rien, et Entrée doit
      // pouvoir activer le bouton focalisé.
      if (e.defaultPrevented || document.querySelector('[aria-modal="true"]')) return;
      // Insensible à la casse : CapsLock, et Shift+Z renvoie 'Z' sous Windows.
      const key = e.key.toLowerCase();
      if ((e.ctrlKey || e.metaKey) && key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
        return;
      }
      if (
        ((e.ctrlKey || e.metaKey) && key === 'y') ||
        ((e.ctrlKey || e.metaKey) && e.shiftKey && key === 'z')
      ) {
        e.preventDefault();
        handleRedo();
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      const toolKeys: Record<string, Tool> = {
        p: 'pencil',
        e: 'eraser',
        f: 'fill',
        k: 'eyedropper',
        l: 'line',
        r: 'square',
        o: 'circle',
        s: 'select',
      };
      const tool = toolKeys[e.key.toLowerCase()];
      if (tool) {
        e.preventDefault();
        setTool(tool);
        return;
      }
      if (e.key === ' ' && onPlayToggle) {
        // Empêche aussi l'activation du bouton focalisé (double bascule).
        e.preventDefault();
        if (!e.repeat) onPlayToggle();
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
  }, [handleUndo, handleRedo, setTool, selectionRef, onPlayToggle]);
}
