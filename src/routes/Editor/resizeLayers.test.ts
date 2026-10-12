import { describe, expect, it } from 'vitest';
import type { PixelLayer } from '@/types';
import { resizeLayers } from './resizeLayers';

const layer = (pixels: PixelLayer['pixels']): PixelLayer => ({ id: 'a', name: 'A', pixels, opacity: 1, visible: true });

describe('resizeLayers', () => {
  it('retire les pixels hors du nouveau cadre', () => {
    const [out] = resizeLayers([layer({ '0,0': '#000000', '3,1': '#111111', '1,3': '#222222' })], 3, 3);
    expect(out?.pixels).toEqual({ '0,0': '#000000' });
  });

  it('garde tous les pixels en agrandissant', () => {
    const pixels = { '0,0': '#000000', '2,2': '#111111' } as const;
    const [out] = resizeLayers([layer(pixels)], 10, 10);
    expect(out?.pixels).toEqual(pixels);
  });
});
