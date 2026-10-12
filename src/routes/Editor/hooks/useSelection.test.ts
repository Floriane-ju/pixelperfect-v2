import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useRef } from 'react';
import { useSelection } from './useSelection';
import type { DrawingData } from '@/types';

const data: DrawingData = {
  width: 4,
  height: 4,
  layers: [
    { id: 'a', name: 'A', pixels: { '0,0': '#ff0000' }, opacity: 1, visible: true },
    { id: 'b', name: 'B', pixels: { '3,3': '#00ff00' }, opacity: 1, visible: true },
  ],
};

function setup() {
  const onLayerChange = vi.fn();
  const pushHistory = vi.fn();
  const result = renderHook(({ activeLayerId }: { activeLayerId: string }) => {
    const latestDataRef = useRef<DrawingData | null>(data);
    return useSelection({ data, activeLayerId, onLayerChange, pushHistory, latestDataRef });
  }, { initialProps: { activeLayerId: 'a' } });
  return { ...result, onLayerChange };
}

function liftTopLeft(result: { current: ReturnType<typeof useSelection> }) {
  act(() => result.current.startDefining({ x: 0, y: 0 }));
  act(() => result.current.updateDefining({ x: 1, y: 1 }));
  act(() => result.current.finishDefining());
}

describe('useSelection', () => {
  it('commit écrit dans le calque d’origine même si le calque actif a changé', () => {
    const { result, rerender, onLayerChange } = setup();
    liftTopLeft(result);
    expect(result.current.hasFloating).toBe(true);

    rerender({ activeLayerId: 'b' });
    onLayerChange.mockClear();
    act(() => result.current.commit());

    expect(onLayerChange).toHaveBeenCalledWith('a', { '0,0': '#ff0000' });
    expect(onLayerChange).not.toHaveBeenCalledWith('b', expect.anything());
  });

  it('cancel restaure le calque d’origine même si le calque actif a changé', () => {
    const { result, rerender, onLayerChange } = setup();
    liftTopLeft(result);

    rerender({ activeLayerId: 'b' });
    onLayerChange.mockClear();
    act(() => result.current.cancel());

    expect(onLayerChange).toHaveBeenCalledWith('a', { '0,0': '#ff0000' });
    expect(onLayerChange).toHaveBeenCalledTimes(1);
  });
});
