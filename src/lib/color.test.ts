import { describe, expect, it } from 'vitest';
import { relativeLuminance, hexToRgb, toneDownLight } from './color';

describe('relativeLuminance', () => {
  it('vaut 1 pour le blanc et 0 pour le noir', () => {
    expect(relativeLuminance(...hexToRgb('#FFFFFF'))).toBeCloseTo(1);
    expect(relativeLuminance(...hexToRgb('#000000'))).toBe(0);
  });
});

describe('toneDownLight', () => {
  const TONE = '#E4DDCF';
  const luma = (css: string) => {
    const [r = 0, g = 0, b = 0] = css.match(/\d+/g)!.map(Number);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };

  it('peint le blanc dans le ton et laisse les couleurs sombres intactes', () => {
    expect(toneDownLight('#fff', TONE)).toBe('rgba(228, 221, 207, 1)');
    expect(toneDownLight('#336699', TONE)).toBe('rgba(51, 102, 153, 1)');
  });

  it('conserve l’ordre de luminosité des gris clairs', () => {
    const grays = ['#999999', '#BBBBBB', '#DDDDDD', '#EEEEEE', '#F8F8F8', '#FFFFFF'];
    const lumas = grays.map((g) => luma(toneDownLight(g, TONE)));
    lumas.slice(1).forEach((l, i) => expect(l).toBeGreaterThan(lumas[i] ?? Infinity));
  });

  it('garde l’alpha', () => {
    expect(toneDownLight('#ffffff80', TONE)).toMatch(/, 0\.50\d*\)$/);
  });
});
