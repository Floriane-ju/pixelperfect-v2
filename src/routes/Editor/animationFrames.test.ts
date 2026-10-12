import { describe, expect, it } from 'vitest';
import type { PixelLayer } from '@/types';
import { ONION_OPACITY, animationLayers, frameIds, previousFrameId } from './animationFrames';

const layer = (id: string, visible = true): PixelLayer => ({ id, name: id, pixels: {}, opacity: 1, visible });

describe('frameIds', () => {
  it('garde les calques visibles dans l\'ordre bas → haut', () => {
    expect(frameIds([layer('a'), layer('b', false), layer('c')])).toEqual(['a', 'c']);
  });
});

describe('previousFrameId', () => {
  it('rend la frame précédente et boucle sur la dernière', () => {
    expect(previousFrameId(['a', 'b', 'c'], 'b')).toBe('a');
    expect(previousFrameId(['a', 'b', 'c'], 'a')).toBe('c');
  });

  it('rend null sans autre frame ou hors frames', () => {
    expect(previousFrameId(['a'], 'a')).toBeNull();
    expect(previousFrameId([], 'a')).toBeNull();
    expect(previousFrameId(['a', 'b'], 'x')).toBeNull();
  });
});

describe('animationLayers', () => {
  const layers = [layer('a'), layer('b'), layer('c')];

  it('affiche la frame montrée, l\'oignon en transparence, masque le reste', () => {
    const [a, b, c] = animationLayers(layers, { shownId: 'b', onionId: 'a' });
    expect(b).toBe(layers[1]);
    expect(a).toMatchObject({ visible: true, opacity: ONION_OPACITY });
    expect(c?.visible).toBe(false);
  });

  it('conserve la référence des pixels', () => {
    const out = animationLayers(layers, { shownId: 'a', onionId: null });
    out.forEach((l, i) => expect(l.pixels).toBe(layers[i]?.pixels));
  });
});
