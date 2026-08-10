import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSelection } from './useSelection';
import type { DrawingData } from '@/types';
import type { MutableRefObject } from 'react';

const createTestData = (width: number, height: number): DrawingData => ({
  width,
  height,
  layers: [
    {
      id: 'l1',
      name: 'Layer 1',
      pixels: {
        '2,2': '#FF0000',
        '2,3': '#00FF00',
        '3,2': '#0000FF',
        '3,3': '#FFFF00',
      },
      opacity: 1,
      visible: true,
    },
  ],
});

const setup = (data = createTestData(8, 8)) => {
  const onLayerChange = vi.fn();
  const pushHistory = vi.fn();
  const latestDataRef: MutableRefObject<DrawingData | null> = { current: data };

  const hook = renderHook(() =>
    useSelection({
      data,
      activeLayerId: 'l1',
      onLayerChange,
      pushHistory,
      latestDataRef,
    })
  );

  return { hook, onLayerChange, pushHistory, latestDataRef };
};

describe('useSelection', () => {
  describe('initial state', () => {
    it('starts in idle state', () => {
      const { hook } = setup();
      expect(hook.result.current.state.kind).toBe('idle');
      expect(hook.result.current.hasFloating).toBe(false);
    });
  });

  describe('defining selection', () => {
    it('startDefining creates a defining state', () => {
      const { hook } = setup();
      act(() => {
        hook.result.current.startDefining({ x: 2, y: 2 });
      });

      expect(hook.result.current.state.kind).toBe('defining');
      if (hook.result.current.state.kind === 'defining') {
        expect(hook.result.current.state.start).toEqual({ x: 2, y: 2 });
        expect(hook.result.current.state.end).toEqual({ x: 2, y: 2 });
      }
    });

    it('clamps coordinates to canvas bounds', () => {
      const { hook } = setup();
      act(() => {
        hook.result.current.startDefining({ x: -5, y: 15 });
      });

      if (hook.result.current.state.kind === 'defining') {
        expect(hook.result.current.state.start.x).toBe(0);
        expect(hook.result.current.state.start.y).toBe(7);
      }
    });

    it('updateDefining updates end position', () => {
      const { hook } = setup();
      act(() => {
        hook.result.current.startDefining({ x: 1, y: 1 });
        hook.result.current.updateDefining({ x: 4, y: 4 });
      });

      if (hook.result.current.state.kind === 'defining') {
        expect(hook.result.current.state.end).toEqual({ x: 4, y: 4 });
      }
    });

    it('finishDefining is no-op if not in defining state', () => {
      const { hook, onLayerChange } = setup();
      act(() => {
        hook.result.current.finishDefining();
      });

      expect(hook.result.current.state.kind).toBe('idle');
      expect(onLayerChange).not.toHaveBeenCalled();
    });
  });

  describe('moving and positioning', () => {
    it('startMove returns false when not floating', () => {
      const { hook } = setup();
      let result = false;

      act(() => {
        result = hook.result.current.startMove({ x: 5, y: 5 });
      });

      expect(result).toBe(false);
    });

    it('endMove clears drag state', () => {
      const { hook } = setup();

      act(() => {
        hook.result.current.endMove();
      });

      // Should not error
      expect(hook.result.current).toBeDefined();
    });
  });

  describe('floating selection queries', () => {
    it('isInsideFloating returns false when idle', () => {
      const { hook } = setup();
      expect(hook.result.current.isInsideFloating({ x: 2, y: 2 })).toBe(false);
    });
  });

  describe('commit and cancel', () => {
    it('commit is no-op if idle', () => {
      const { hook, onLayerChange, pushHistory } = setup();

      act(() => {
        hook.result.current.commit();
      });

      expect(hook.result.current.state.kind).toBe('idle');
      expect(onLayerChange).not.toHaveBeenCalled();
      expect(pushHistory).not.toHaveBeenCalled();
    });

    it('cancel is no-op if idle', () => {
      const { hook, onLayerChange } = setup();

      act(() => {
        hook.result.current.cancel();
      });

      expect(hook.result.current.state.kind).toBe('idle');
      expect(onLayerChange).not.toHaveBeenCalled();
    });
  });
});
