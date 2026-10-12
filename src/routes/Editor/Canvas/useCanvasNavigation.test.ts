import { describe, expect, it } from 'vitest';
import { clampToViewport } from './useCanvasNavigation';

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
