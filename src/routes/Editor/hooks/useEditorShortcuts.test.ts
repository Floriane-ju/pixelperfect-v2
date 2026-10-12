import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { MutableRefObject } from 'react';
import { useEditorShortcuts } from './useEditorShortcuts';
import type { UseSelectionApi } from './useSelection';

const selectionRef = { current: {} } as MutableRefObject<UseSelectionApi>;
const press = (init: KeyboardEventInit) => document.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', ...init }));

function setup(onPlayToggle?: () => void) {
  return renderHook(() =>
    useEditorShortcuts({ handleUndo: vi.fn(), handleRedo: vi.fn(), setTool: vi.fn(), selectionRef, onPlayToggle }),
  );
}

describe('useEditorShortcuts — Espace', () => {
  it('bascule la lecture, une seule fois si la touche est maintenue', () => {
    const toggle = vi.fn();
    setup(toggle);
    press({});
    press({ repeat: true });
    expect(toggle).toHaveBeenCalledTimes(1);
  });

  it('ne fait rien hors mode animation', () => {
    setup();
    const e = new KeyboardEvent('keydown', { key: ' ', cancelable: true });
    document.dispatchEvent(e);
    expect(e.defaultPrevented).toBe(false);
  });
});
