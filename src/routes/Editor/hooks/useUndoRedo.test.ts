import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useRef, useState } from 'react';
import { trimHistory, useUndoRedo } from './useUndoRedo';
import type { DrawingData, DrawingRow, HexColor } from '@/types';

const makeData = (tag: string): DrawingData => ({
  width: 4,
  height: 4,
  layers: [{ id: 'l1', name: tag, pixels: {}, opacity: 1, visible: true }],
});

const makeRow = (data: DrawingData): DrawingRow => ({
  id: 'd1',
  title: 't',
  data,
  created_at: '',
  updated_at: '',
  group: null,
  owner_id: 'u1',
  collaborator_count: 1,
});

function setup(initial: DrawingData) {
  const scheduleSave = vi.fn();
  const result = renderHook(() => {
    const [drawing, setDrawing] = useState<DrawingRow | null>(makeRow(initial));
    const latestDataRef = useRef<DrawingData | null>(initial);
    // keep ref synced with state, like real Editor does
    latestDataRef.current = drawing?.data ?? null;
    const undo = useUndoRedo({ latestDataRef, setDrawing, scheduleSave });
    return { drawing, setDrawing, latestDataRef, undo };
  });
  return { result, scheduleSave };
}

describe('useUndoRedo', () => {
  beforeEach(() => vi.clearAllMocks());

  it('starts with no undo/redo available', () => {
    const { result } = setup(makeData('a'));
    expect(result.result.current.undo.canUndo).toBe(false);
    expect(result.result.current.undo.canRedo).toBe(false);
  });

  it('pushes history on draw end and enables undo', () => {
    const { result } = setup(makeData('a'));
    act(() => {
      result.result.current.undo.handleDrawStart();
      // simulate stroke applied → state moves to b
      result.result.current.setDrawing(makeRow(makeData('b')));
      result.result.current.undo.handleDrawEnd();
    });
    expect(result.result.current.undo.canUndo).toBe(true);
    expect(result.result.current.undo.canRedo).toBe(false);
  });

  it('handleDrawEnd without start is a no-op', () => {
    const { result } = setup(makeData('a'));
    act(() => { result.result.current.undo.handleDrawEnd(); });
    expect(result.result.current.undo.canUndo).toBe(false);
  });

  it('undo restores prior data and enables redo', () => {
    const { result, scheduleSave } = setup(makeData('a'));
    act(() => {
      result.result.current.undo.handleDrawStart();
      result.result.current.setDrawing(makeRow(makeData('b')));
      result.result.current.undo.handleDrawEnd();
    });
    act(() => { result.result.current.undo.handleUndo(); });
    expect(result.result.current.drawing?.data.layers[0]!.name).toBe('a');
    expect(result.result.current.undo.canUndo).toBe(false);
    expect(result.result.current.undo.canRedo).toBe(true);
    expect(scheduleSave).toHaveBeenCalled();
  });

  it('undo/redo gardent les réglages courants du dessin', () => {
    const { result } = setup(makeData('a'));
    act(() => {
      result.result.current.undo.handleDrawStart();
      result.result.current.setDrawing(makeRow(makeData('b')));
      result.result.current.undo.handleDrawEnd();
    });
    act(() => { result.result.current.setDrawing(makeRow({ ...makeData('b'), settings: { fps: 12 } })); });
    act(() => { result.result.current.undo.handleUndo(); });
    expect(result.result.current.drawing?.data.layers[0]!.name).toBe('a');
    expect(result.result.current.drawing?.data.settings).toEqual({ fps: 12 });
    act(() => { result.result.current.undo.handleRedo(); });
    expect(result.result.current.drawing?.data.settings).toEqual({ fps: 12 });
  });

  it('redo replays after undo', () => {
    const { result } = setup(makeData('a'));
    act(() => {
      result.result.current.undo.handleDrawStart();
      result.result.current.setDrawing(makeRow(makeData('b')));
      result.result.current.undo.handleDrawEnd();
    });
    act(() => { result.result.current.undo.handleUndo(); });
    act(() => { result.result.current.undo.handleRedo(); });
    expect(result.result.current.drawing?.data.layers[0]!.name).toBe('b');
    expect(result.result.current.undo.canUndo).toBe(true);
    expect(result.result.current.undo.canRedo).toBe(false);
  });

  it('new push after undo invalidates redo stack', () => {
    const { result } = setup(makeData('a'));
    act(() => {
      result.result.current.undo.handleDrawStart();
      result.result.current.setDrawing(makeRow(makeData('b')));
      result.result.current.undo.handleDrawEnd();
    });
    act(() => { result.result.current.undo.handleUndo(); });
    expect(result.result.current.undo.canRedo).toBe(true);
    act(() => {
      result.result.current.undo.handleDrawStart();
      result.result.current.setDrawing(makeRow(makeData('c')));
      result.result.current.undo.handleDrawEnd();
    });
    expect(result.result.current.undo.canRedo).toBe(false);
  });

  it('undo on empty history is a no-op', () => {
    const { result, scheduleSave } = setup(makeData('a'));
    act(() => { result.result.current.undo.handleUndo(); });
    expect(scheduleSave).not.toHaveBeenCalled();
    expect(result.result.current.drawing?.data.layers[0]!.name).toBe('a');
  });

  it('caps history at MAX_HISTORY (50) — oldest dropped', () => {
    const { result } = setup(makeData('s0'));
    for (let i = 1; i <= 55; i++) {
      act(() => {
        result.result.current.undo.handleDrawStart();
        result.result.current.setDrawing(makeRow(makeData(`s${i}`)));
        result.result.current.undo.handleDrawEnd();
      });
    }
    // undo 50 times should be possible, the 51st should be a no-op
    for (let i = 0; i < 50; i++) {
      act(() => { result.result.current.undo.handleUndo(); });
    }
    expect(result.result.current.undo.canUndo).toBe(false);
    // earliest reachable snapshot is s5 (s0..s4 dropped)
    expect(result.result.current.drawing?.data.layers[0]!.name).toBe('s5');
  });
});

describe('trimHistory', () => {
  const black = '#000000' as HexColor;
  const pixels = (n: number, tag: string): Record<string, HexColor> =>
    Object.fromEntries(Array.from({ length: n }, (_, i) => [`${tag}${i},0`, black]));
  const snap = (...layers: Record<string, HexColor>[]): DrawingData => ({
    width: 8,
    height: 8,
    layers: layers.map((p, i) => ({ id: `l${i}`, name: '', pixels: p, opacity: 1, visible: true })),
  });

  it('supprime les plus anciens au-delà du budget en gardant le plus récent', () => {
    const past = [snap(pixels(4, 'a')), snap(pixels(4, 'b')), snap(pixels(4, 'c'))];
    expect(trimHistory(past, 8)).toEqual(past.slice(1));
    expect(trimHistory(past, 1)).toEqual(past.slice(2));
  });

  it('compte une seule fois un calque partagé entre snapshots', () => {
    const shared = pixels(6, 's');
    const past = [snap(shared, pixels(1, 'a')), snap(shared, pixels(1, 'b')), snap(shared, pixels(1, 'c'))];
    // 6 partagés + 3 propres = 9 pixels réels (21 si chaque snapshot était compté en entier).
    expect(trimHistory(past, 9)).toBe(past);
  });
});
