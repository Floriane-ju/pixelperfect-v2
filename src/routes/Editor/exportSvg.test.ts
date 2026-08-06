import { describe, it, expect } from 'vitest';
import { buildLayersSvg } from './exportSvg';
import type { PixelLayer } from '@/types';

const layer = (overrides: Partial<PixelLayer> & { pixels: PixelLayer['pixels'] }): PixelLayer => ({
  id: 'l1',
  name: 'layer',
  visible: true,
  opacity: 1,
  ...overrides,
});

describe('buildLayersSvg', () => {
  it('returns valid SVG wrapper', () => {
    const svg = buildLayersSvg([], 16, 16);
    expect(svg).toMatch(/^<svg /);
    expect(svg).toContain('viewBox="0 0 16 16"');
    expect(svg).toContain('width="16" height="16"');
  });

  it('skips invisible layers', () => {
    const svg = buildLayersSvg([layer({ visible: false, pixels: { '0,0': '#ff0000' } })], 8, 8);
    expect(svg).not.toContain('#ff0000');
  });

  it('renders a visible pixel as a path', () => {
    const svg = buildLayersSvg([layer({ pixels: { '0,0': '#ff0000' } })], 8, 8);
    expect(svg).toContain('#ff0000');
    expect(svg).toContain('<path');
  });

  it('composites two layers (top wins for opaque pixels)', () => {
    const bottom = layer({ id: 'b', pixels: { '0,0': '#ff0000' } });
    const top = layer({ id: 't', pixels: { '0,0': '#0000ff' } });
    const svg = buildLayersSvg([bottom, top], 8, 8);
    expect(svg).toContain('#0000ff');
  });

  // Signed area of every subpath must equal the number of painted pixels, and no
  // subpath may be degenerate — guards the boundary tracing (saddle corners, holes).
  const pathArea = (svg: string): number => {
    const d = /d="([^"]+)"/.exec(svg)?.[1] ?? '';
    let area = 0;
    for (const sub of d.split('M').filter(Boolean)) {
      expect(sub).not.toBe('Z');
      const pts = sub.replace(/Z$/, '').split('L').map(p => p.split(' ').map(Number) as [number, number]);
      expect(pts.length).toBeGreaterThanOrEqual(3);
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i]!;
        const b = pts[(i + 1) % pts.length]!;
        expect(Number.isFinite(a[0]) && Number.isFinite(a[1])).toBe(true);
        area += a[0] * b[1] - b[0] * a[1];
      }
    }
    return area / 2;
  };

  const fromRows = (rows: string[]): PixelLayer['pixels'] => {
    const pixels: PixelLayer['pixels'] = {};
    rows.forEach((row, y) => [...row].forEach((c, x) => {
      if (c === 'X') pixels[`${x},${y}`] = '#ff0000';
    }));
    return pixels;
  };

  it.each([
    ['saddle corner, top-left/bottom-right diagonal', ['XX.', 'X.X', 'XXX'], 7],
    ['saddle corner, top-right/bottom-left diagonal', ['.XX', 'X.X', 'XXX'], 7],
    ['enclosed hole', ['XXX', 'X.X', 'XXX'], 8],
    ['double saddle', ['XX.X', 'X.XX', 'XXX.'], 9],
    ['single pixel', ['X'], 1],
  ])('traces %s without degenerate subpaths', (_name, rows, expected) => {
    const svg = buildLayersSvg([layer({ pixels: fromRows(rows) })], 4, 4);
    expect(pathArea(svg)).toBe(expected);
  });

  it('handles empty layers array', () => {
    const svg = buildLayersSvg([], 32, 32);
    expect(svg).toContain('viewBox="0 0 32 32"');
    expect(svg).not.toContain('<path');
  });
});
