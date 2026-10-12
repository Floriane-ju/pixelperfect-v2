import { describe, it, expect } from 'vitest';
import {
  bresenham,
  floodFill,
  getRectPixels,
  getEllipsePixels,
  expandMirror,
  expandRadial,
  expandRotate180,
  getShapePixels,
} from './shapePixels';
import type { HexColor } from '@/types';

const hex = (s: string) => s as HexColor;
const key = (p: { x: number; y: number }) => `${p.x},${p.y}`;
const sortKeys = (pts: Array<{ x: number; y: number }>) => pts.map(key).sort();

describe('bresenham', () => {
  it('returns single point when start equals end', () => {
    expect(bresenham(3, 3, 3, 3)).toEqual([{ x: 3, y: 3 }]);
  });

  it('horizontal line includes both endpoints', () => {
    const pts = bresenham(0, 0, 3, 0);
    expect(pts).toEqual([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 3, y: 0 },
    ]);
  });

  it('vertical line', () => {
    const pts = bresenham(2, 0, 2, 2);
    expect(pts).toEqual([
      { x: 2, y: 0 },
      { x: 2, y: 1 },
      { x: 2, y: 2 },
    ]);
  });

  it('diagonal line', () => {
    const pts = bresenham(0, 0, 3, 3);
    expect(pts).toEqual([
      { x: 0, y: 0 },
      { x: 1, y: 1 },
      { x: 2, y: 2 },
      { x: 3, y: 3 },
    ]);
  });

  it('reversed direction symmetric in length', () => {
    const a = bresenham(0, 0, 5, 2);
    const b = bresenham(5, 2, 0, 0);
    expect(a.length).toBe(b.length);
    expect(a[0]).toEqual({ x: 0, y: 0 });
    expect(b[0]).toEqual({ x: 5, y: 2 });
  });

  it('negative direction works', () => {
    const pts = bresenham(2, 2, 0, 0);
    expect(pts).toEqual([
      { x: 2, y: 2 },
      { x: 1, y: 1 },
      { x: 0, y: 0 },
    ]);
  });
});

describe('floodFill', () => {
  it('returns null when target color equals fill color', () => {
    const pixels = { '0,0': hex('#ff0000') };
    expect(floodFill(pixels, 0, 0, 4, 4, hex('#ff0000'))).toBeNull();
  });

  it('fills empty area (undefined target)', () => {
    const pixels = {};
    const out = floodFill(pixels, 0, 0, 2, 2, hex('#00ff00'));
    expect(out).not.toBeNull();
    expect(out!['0,0']).toBe('#00ff00');
    expect(out!['1,0']).toBe('#00ff00');
    expect(out!['0,1']).toBe('#00ff00');
    expect(out!['1,1']).toBe('#00ff00');
  });

  it('does not cross color boundary', () => {
    const pixels: Record<string, HexColor> = {
      '0,0': hex('#000000'),
      '1,0': hex('#000000'),
      '2,0': hex('#ffffff'),
      '0,1': hex('#000000'),
      '1,1': hex('#ffffff'),
      '2,1': hex('#ffffff'),
    };
    const out = floodFill(pixels, 0, 0, 3, 2, hex('#ff0000'));
    expect(out).not.toBeNull();
    expect(out!['0,0']).toBe('#ff0000');
    expect(out!['1,0']).toBe('#ff0000');
    expect(out!['0,1']).toBe('#ff0000');
    expect(out!['2,0']).toBe('#ffffff');
    expect(out!['1,1']).toBe('#ffffff');
    expect(out!['2,1']).toBe('#ffffff');
  });

  it('does not mutate input', () => {
    const pixels = { '0,0': hex('#000000') };
    const snapshot = { ...pixels };
    floodFill(pixels, 0, 0, 2, 2, hex('#ff0000'));
    expect(pixels).toEqual(snapshot);
  });

  it('respects width/height bounds', () => {
    const out = floodFill({}, 0, 0, 1, 1, hex('#ff0000'));
    expect(out).not.toBeNull();
    expect(Object.keys(out!)).toEqual(['0,0']);
  });

  it('flood-fills only connected region of same color', () => {
    const pixels: Record<string, HexColor> = {
      '0,0': hex('#000000'),
      '2,0': hex('#000000'),
    };
    const out = floodFill(pixels, 0, 0, 3, 1, hex('#ff0000'));
    expect(out!['0,0']).toBe('#ff0000');
    expect(out!['2,0']).toBe('#000000');
  });
});

describe('getRectPixels', () => {
  it('covers only the single point for 0×0 rect', () => {
    const pts = getRectPixels(2, 2, 2, 2);
    expect(new Set(pts.map(key))).toEqual(new Set(['2,2']));
  });

  it('returns hollow rectangle outline', () => {
    const pts = getRectPixels(0, 0, 2, 2);
    const keys = new Set(pts.map(key));
    expect(keys.has('0,0')).toBe(true);
    expect(keys.has('2,2')).toBe(true);
    expect(keys.has('1,0')).toBe(true);
    expect(keys.has('1,2')).toBe(true);
    expect(keys.has('0,1')).toBe(true);
    expect(keys.has('2,1')).toBe(true);
    expect(keys.has('1,1')).toBe(false);
  });

  it('normalizes reversed coordinates', () => {
    const a = sortKeys(getRectPixels(0, 0, 3, 2));
    const b = sortKeys(getRectPixels(3, 2, 0, 0));
    expect(a).toEqual(b);
  });
});

describe('getEllipsePixels', () => {
  it('trace un contour 8-connexe, y compris pour les ellipses très plates', () => {
    for (let w = 1; w <= 40; w++) {
      for (let h = 1; h <= 12; h++) {
        const pts = getEllipsePixels(0, 0, w, h);
        const set = new Set(pts.map(p => `${p.x},${p.y}`));
        const first = pts[0]!;
        const reached = new Set([`${first.x},${first.y}`]);
        const queue = [first];
        while (queue.length > 0) {
          const { x, y } = queue.pop()!;
          for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
              const k = `${x + dx},${y + dy}`;
              if (set.has(k) && !reached.has(k)) { reached.add(k); queue.push({ x: x + dx, y: y + dy }); }
            }
          }
        }
        expect(reached.size, `ellipse ${w}×${h}`).toBe(set.size);
      }
    }
  });

  it('returns single point for tiny radius', () => {
    expect(getEllipsePixels(2, 2, 2, 2)).toEqual([{ x: 2, y: 2 }]);
  });

  it('returns vertical line when rx ≈ 0', () => {
    const pts = getEllipsePixels(5, 0, 5, 4);
    const xs = new Set(pts.map(p => p.x));
    expect(xs).toEqual(new Set([5]));
    expect(pts.length).toBe(5);
  });

  it('returns horizontal line when ry ≈ 0', () => {
    const pts = getEllipsePixels(0, 5, 4, 5);
    const ys = new Set(pts.map(p => p.y));
    expect(ys).toEqual(new Set([5]));
    expect(pts.length).toBe(5);
  });

  it('produces unique points only', () => {
    const pts = getEllipsePixels(0, 0, 10, 6);
    const keys = pts.map(key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('symmetry around center', () => {
    const pts = getEllipsePixels(0, 0, 6, 6);
    const cx = 3, cy = 3;
    const set = new Set(pts.map(key));
    for (const { x, y } of pts) {
      const sx = 2 * cx - x;
      const sy = 2 * cy - y;
      expect(set.has(`${sx},${sy}`)).toBe(true);
    }
  });

  it('small even circle (4px) has a two-pixel top row', () => {
    const topRow = getEllipsePixels(0, 0, 3, 3).filter(p => p.y === 0).map(p => p.x).sort((a, b) => a - b);
    expect(topRow).toEqual([1, 2]);
  });

  it('even circle (10px) has a symmetric four-pixel top row', () => {
    const topRow = getEllipsePixels(0, 0, 9, 9).filter(p => p.y === 0).map(p => p.x).sort((a, b) => a - b);
    expect(topRow).toEqual([3, 4, 5, 6]);
  });

  const sizes: Array<[number, number, number, number]> = [
    [0, 0, 3, 3], [0, 0, 4, 4], [0, 0, 6, 6], [0, 0, 7, 7], [0, 0, 9, 9], [0, 0, 10, 10],
    [0, 0, 15, 15], [0, 0, 16, 16], [0, 0, 10, 6], [0, 0, 7, 12], [2, 1, 11, 4], [0, 0, 16, 9],
    [0, 0, 1, 1], [0, 0, 2, 1], [0, 0, 1, 6], [3, 3, 4, 9], [0, 0, 15, 2], [0, 0, 20, 3],
  ];

  describe.each(sizes)('bbox (%i,%i)→(%i,%i)', (x0, y0, x1, y1) => {
    const minX = Math.min(x0, x1), maxX = Math.max(x0, x1);
    const minY = Math.min(y0, y1), maxY = Math.max(y0, y1);
    const pts = getEllipsePixels(x0, y0, x1, y1);
    const set = new Set(pts.map(key));

    it('stays strictly inside the inclusive bbox', () => {
      for (const { x, y } of pts) {
        expect(x).toBeGreaterThanOrEqual(minX);
        expect(x).toBeLessThanOrEqual(maxX);
        expect(y).toBeGreaterThanOrEqual(minY);
        expect(y).toBeLessThanOrEqual(maxY);
      }
    });

    it('touches all four sides of the bbox', () => {
      expect(Math.min(...pts.map(p => p.x))).toBe(minX);
      expect(Math.max(...pts.map(p => p.x))).toBe(maxX);
      expect(Math.min(...pts.map(p => p.y))).toBe(minY);
      expect(Math.max(...pts.map(p => p.y))).toBe(maxY);
    });

    it('is horizontally symmetric', () => {
      for (const { x, y } of pts) {
        expect(set.has(`${minX + maxX - x},${y}`)).toBe(true);
      }
    });

    it('is vertically symmetric', () => {
      for (const { x, y } of pts) {
        expect(set.has(`${x},${minY + maxY - y}`)).toBe(true);
      }
    });
  });
});

describe('expandMirror', () => {
  const w = 4, h = 4;

  it('returns input unchanged when no mirror', () => {
    const pts = [{ x: 0, y: 0 }];
    expect(expandMirror(pts, w, h, false, false)).toBe(pts);
  });

  it('mirrors horizontally', () => {
    const out = expandMirror([{ x: 0, y: 1 }], w, h, true, false);
    expect(sortKeys(out)).toEqual(sortKeys([{ x: 0, y: 1 }, { x: 3, y: 1 }]));
  });

  it('mirrors vertically', () => {
    const out = expandMirror([{ x: 1, y: 0 }], w, h, false, true);
    expect(sortKeys(out)).toEqual(sortKeys([{ x: 1, y: 0 }, { x: 1, y: 3 }]));
  });

  it('mirrors both axes (4 points from 1)', () => {
    const out = expandMirror([{ x: 0, y: 0 }], w, h, true, true);
    expect(sortKeys(out)).toEqual(sortKeys([
      { x: 0, y: 0 },
      { x: 3, y: 0 },
      { x: 0, y: 3 },
      { x: 3, y: 3 },
    ]));
  });

  it('deduplicates when mirror lands on original', () => {
    // center pixel of odd-sized canvas mirrors onto itself
    const out = expandMirror([{ x: 2, y: 2 }], 5, 5, true, true);
    expect(out).toEqual([{ x: 2, y: 2 }]);
  });
});

describe('expandRotate180', () => {
  const w = 4, h = 4;

  it('adds the centre-opposite point', () => {
    const out = expandRotate180([{ x: 0, y: 1 }], w, h);
    expect(sortKeys(out)).toEqual(sortKeys([{ x: 0, y: 1 }, { x: 3, y: 2 }]));
  });

  it('deduplicates centre pixel of odd canvas', () => {
    expect(expandRotate180([{ x: 2, y: 2 }], 5, 5)).toEqual([{ x: 2, y: 2 }]);
  });
});

describe('expandRadial', () => {
  // canvas 5×5 → centre entier (2,2)
  const w = 5, h = 5;

  it('returns input unchanged when segments < 2', () => {
    const pts = [{ x: 0, y: 0 }];
    expect(expandRadial(pts, w, h, 1, false)).toBe(pts);
  });

  it('rotation only: 4 rotated copies, no mirror', () => {
    const out = expandRadial([{ x: 2, y: 0 }], w, h, 4, true);
    expect(sortKeys(out)).toEqual(sortKeys([
      { x: 2, y: 0 },
      { x: 4, y: 2 },
      { x: 2, y: 4 },
      { x: 0, y: 2 },
    ]));
  });

  it('kaléidoscope (rotationOnly false) doubles a chiral point to 2N copies', () => {
    const rot = expandRadial([{ x: 3, y: 0 }], w, h, 4, true);
    const kal = expandRadial([{ x: 3, y: 0 }], w, h, 4, false);
    expect(rot.length).toBe(4);
    expect(kal.length).toBe(8);
    // le kaléidoscope est un sur-ensemble des copies en rotation pure
    const kalKeys = new Set(kal.map(key));
    for (const p of rot) expect(kalKeys.has(key(p))).toBe(true);
  });

  it('center pixel maps onto itself (deduplicated)', () => {
    expect(expandRadial([{ x: 2, y: 2 }], w, h, 8, false)).toEqual([{ x: 2, y: 2 }]);
  });
});

describe('getShapePixels', () => {
  it('dispatches line → bresenham', () => {
    const out = getShapePixels('line', { x: 0, y: 0 }, { x: 2, y: 0 });
    expect(out).toEqual(bresenham(0, 0, 2, 0));
  });

  it('dispatches square → getRectPixels', () => {
    const out = getShapePixels('square', { x: 0, y: 0 }, { x: 2, y: 2 });
    expect(sortKeys(out)).toEqual(sortKeys(getRectPixels(0, 0, 2, 2)));
  });

  it('dispatches circle → getEllipsePixels', () => {
    const out = getShapePixels('circle', { x: 0, y: 0 }, { x: 4, y: 4 });
    expect(sortKeys(out)).toEqual(sortKeys(getEllipsePixels(0, 0, 4, 4)));
  });
});
