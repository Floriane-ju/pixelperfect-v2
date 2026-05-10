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

  it('handles empty layers array', () => {
    const svg = buildLayersSvg([], 32, 32);
    expect(svg).toContain('viewBox="0 0 32 32"');
    expect(svg).not.toContain('<path');
  });
});
