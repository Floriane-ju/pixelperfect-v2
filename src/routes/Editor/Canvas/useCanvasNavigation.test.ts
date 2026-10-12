import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { clampToViewport, useCanvasNavigation } from './useCanvasNavigation';

const viewport = { w: 400, h: 300 };
const size = { w: 100, h: 100 };

describe('clampToViewport', () => {
  it('garde un dessin plus petit que la vue entièrement visible', () => {
    const t = clampToViewport({ x: 1000, y: -1000, scale: 1, angle: 0 }, size, viewport);
    expect(t.x).toBe(150);
    expect(t.y).toBe(-100);
  });

  it('empêche un dessin plus grand que la vue de laisser du vide au bord', () => {
    const t = clampToViewport({ x: 1000, y: 1000, scale: 10, angle: 0 }, size, viewport);
    expect(t.x).toBe(300);
    expect(t.y).toBe(350);
  });

  it('laisse passer une position déjà valide', () => {
    const t = clampToViewport({ x: 20, y: -30, scale: 1, angle: 0 }, size, viewport);
    expect(t).toEqual({ x: 20, y: -30, scale: 1, angle: 0 });
  });

  it('tient compte de la rotation (boîte englobante)', () => {
    const t = clampToViewport({ x: 1000, y: 0, scale: 1, angle: 45 }, size, viewport);
    expect(t.x).toBeCloseTo(200 - 50 * Math.SQRT2);
  });
});

describe('tap à deux doigts', () => {
  afterEach(() => vi.useRealTimers());

  const setup = () => {
    const wrapper = document.createElement('div');
    return renderHook(() => useCanvasNavigation({ current: wrapper }, { current: { w: 100, h: 100 } })).result;
  };

  it('détecte un tap bref et immobile au lever du dernier doigt', () => {
    const nav = setup();
    act(() => {
      nav.current.onNavPointerDown(1, 10, 10, 0, true);
      nav.current.onNavPointerDown(2, 60, 10, 0, true);
    });
    let first = true, last = false;
    act(() => {
      first = nav.current.onNavPointerUp(1);
      last = nav.current.onNavPointerUp(2);
    });
    expect(first).toBe(false);
    expect(last).toBe(true);
  });

  it('ignore un pinch (doigts déplacés)', () => {
    const nav = setup();
    let last = true;
    act(() => {
      nav.current.onNavPointerDown(1, 10, 10, 0, true);
      nav.current.onNavPointerDown(2, 60, 10, 0, true);
      nav.current.onNavPointerMove(2, 120, 10);
      nav.current.onNavPointerUp(1);
      last = nav.current.onNavPointerUp(2);
    });
    expect(last).toBe(false);
  });

  it('ignore un appui long à deux doigts', () => {
    vi.useFakeTimers();
    const nav = setup();
    let last = true;
    act(() => {
      nav.current.onNavPointerDown(1, 10, 10, 0, true);
      nav.current.onNavPointerDown(2, 60, 10, 0, true);
    });
    vi.advanceTimersByTime(500);
    act(() => {
      nav.current.onNavPointerUp(1);
      last = nav.current.onNavPointerUp(2);
    });
    expect(last).toBe(false);
  });

  it('ignore un tap à trois doigts', () => {
    const nav = setup();
    let last = true;
    act(() => {
      nav.current.onNavPointerDown(1, 10, 10, 0, true);
      nav.current.onNavPointerDown(2, 60, 10, 0, true);
      nav.current.onNavPointerDown(3, 90, 10, 0, true);
      nav.current.onNavPointerUp(1);
      nav.current.onNavPointerUp(2);
      last = nav.current.onNavPointerUp(3);
    });
    expect(last).toBe(false);
  });
});
