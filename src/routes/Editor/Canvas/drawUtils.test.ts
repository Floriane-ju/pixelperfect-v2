import { describe, it, expect } from 'vitest';
import { stampBrush, applyBrushPixels } from './drawUtils';
import type { HexColor } from '@/types';

const key = (p: { x: number; y: number }) => `${p.x},${p.y}`;

describe('stampBrush', () => {
  it('returns the input unchanged for size 1', () => {
    const pts = [{ x: 3, y: 4 }];
    expect(stampBrush(pts, 1)).toBe(pts);
  });

  it('has no duplicate pixels when stamps overlap', () => {
    const out = stampBrush([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }], 4);
    const keys = out.map(key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('keeps the same pixel set and first-occurrence order as the naive stamp', () => {
    const pts = [{ x: 5, y: 5 }, { x: 6, y: 5 }, { x: 6, y: 7 }, { x: -2, y: 1 }];
    const size = 5;
    const offset = Math.floor((size - 1) / 2);
    const naive: Array<{ x: number; y: number }> = [];
    for (const { x, y } of pts) {
      for (let dy = 0; dy < size; dy++) {
        for (let dx = 0; dx < size; dx++) naive.push({ x: x + dx - offset, y: y + dy - offset });
      }
    }
    const seen = new Set<string>();
    const expected = naive.filter(p => {
      const k = key(p);
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    expect(stampBrush(pts, size)).toEqual(expected);
  });
});

describe('applyBrushPixels', () => {
  const red = '#ff0000' as HexColor;

  it('reports no change when pencil repaints the same colour', () => {
    const map = { '1,1': red };
    expect(applyBrushPixels(map, null, [{ x: 1, y: 1 }], false, red, 4, 4)).toBe(false);
    expect(map).toEqual({ '1,1': red });
  });

  it('reports no change when erasing an empty pixel', () => {
    expect(applyBrushPixels({}, null, [{ x: 0, y: 0 }], true, red, 4, 4)).toBe(false);
  });

  it('reports a change when pencil paints a new pixel', () => {
    const map: Record<string, HexColor> = {};
    expect(applyBrushPixels(map, null, [{ x: 2, y: 3 }], false, red, 4, 4)).toBe(true);
    expect(map).toEqual({ '2,3': red });
  });

  it('ignores pixels outside the canvas', () => {
    const map: Record<string, HexColor> = {};
    expect(applyBrushPixels(map, null, [{ x: -1, y: 0 }, { x: 4, y: 0 }], false, red, 4, 4)).toBe(false);
    expect(map).toEqual({});
  });
});
