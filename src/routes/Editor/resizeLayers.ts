import type { PixelLayer } from '@/types';

/** Recadre les calques sur width × height, ancrés en haut à gauche : les pixels hors cadre sont perdus. */
export function resizeLayers(layers: PixelLayer[], width: number, height: number): PixelLayer[] {
  return layers.map(layer => {
    const pixels: PixelLayer['pixels'] = {};
    for (const [key, color] of Object.entries(layer.pixels)) {
      const [x = -1, y = -1] = key.split(',').map(Number);
      if (x < width && y < height) pixels[key] = color;
    }
    return { ...layer, pixels };
  });
}
