import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DRAG_HOLD_MS, findDropTarget, useDragReorder } from './useDragReorder';

const spans = [
  { id: 'a', start: 0, end: 10 },
  { id: 'b', start: 20, end: 30 },
  { id: 'c', start: 40, end: 50 },
];

describe('findDropTarget', () => {
  it('cible la première moitié de l’élément survolé comme « avant »', () => {
    expect(findDropTarget(spans, 22, 'a')).toEqual({ targetId: 'b', pos: 'before' });
  });

  it('cible la seconde moitié comme « après »', () => {
    expect(findDropTarget(spans, 28, 'a')).toEqual({ targetId: 'b', pos: 'after' });
  });

  it('ignore l’élément déplacé', () => {
    expect(findDropTarget(spans, 25, 'b')).toEqual({ targetId: null, pos: 'before' });
  });

  it('borne aux extrémités hors de la liste', () => {
    expect(findDropTarget(spans, -5, 'b')).toEqual({ targetId: 'a', pos: 'before' });
    expect(findDropTarget(spans, 99, 'b')).toEqual({ targetId: 'c', pos: 'after' });
  });

  it('ne cible rien dans un interstice', () => {
    expect(findDropTarget(spans, 15, 'c')).toEqual({ targetId: null, pos: 'before' });
  });
});

describe('useDragReorder — poignée', () => {
  afterEach(() => vi.useRealTimers());

  const pointer = (stopPropagation = vi.fn()) => {
    const el = { setPointerCapture: vi.fn(), hasPointerCapture: () => false, releasePointerCapture: vi.fn() };
    return { pointerId: 1, type: 'pointerup', currentTarget: el, stopPropagation, preventDefault: vi.fn() };
  };

  it('un appui bref laisse passer le clic sans démarrer de glisser', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useDragReorder<HTMLLIElement>({ axis: 'x', onDrop: vi.fn() }));
    const props = result.current.handleProps('a');
    act(() => props.onPointerDown(pointer() as never));
    act(() => props.onPointerUp(pointer() as never));
    act(() => { vi.advanceTimersByTime(DRAG_HOLD_MS); });
    expect(result.current.drag).toBeNull();
    const stop = vi.fn();
    props.onClick({ stopPropagation: stop } as never);
    expect(stop).not.toHaveBeenCalled();
  });

  it('un appui long démarre le glisser et absorbe le clic', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useDragReorder<HTMLLIElement>({ axis: 'x', onDrop: vi.fn() }));
    act(() => result.current.handleProps('a').onPointerDown(pointer() as never));
    act(() => { vi.advanceTimersByTime(DRAG_HOLD_MS); });
    expect(result.current.drag?.id).toBe('a');
    const stop = vi.fn();
    result.current.handleProps('a').onClick({ stopPropagation: stop } as never);
    expect(stop).toHaveBeenCalled();
  });
});
