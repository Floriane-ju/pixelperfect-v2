import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useRef, useState } from 'react';
import { useUndoRedo } from './useUndoRedo';
import type { DrawingData, DrawingRow } from '@/types';

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
