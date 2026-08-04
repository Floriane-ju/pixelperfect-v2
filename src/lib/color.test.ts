import { describe, expect, it } from 'vitest';
import { relativeLuminance, hexToRgb, tintFromRamp } from './color';

const RAMP = ['#E4DEFF', '#A394F8', '#6752DE', '#47389E'];

describe('relativeLuminance', () => {
  it('vaut 1 pour le blanc et 0 pour le noir', () => {
    expect(relativeLuminance(...hexToRgb('#FFFFFF'))).toBeCloseTo(1);
    expect(relativeLuminance(...hexToRgb('#000000'))).toBe(0);
  });
});

describe('tintFromRamp', () => {
  it('mappe le blanc sur le stop le plus clair et le noir sur le plus sombre', () => {
    expect(tintFromRamp('#FFFFFF', RAMP)).toBe(RAMP[0]);
    expect(tintFromRamp('#000000', RAMP)).toBe(RAMP[RAMP.length - 1]);
  });

  it('mappe un ton intermédiaire au milieu de la rampe', () => {
    expect(RAMP.slice(1, 3)).toContain(tintFromRamp('#888888', RAMP));
  });

  it('renvoie la couleur d’origine si la rampe est vide ou la couleur illisible', () => {
    expect(tintFromRamp('#123456', [])).toBe('#123456');
    expect(tintFromRamp('#zzzzzz', RAMP)).toBe('#zzzzzz');
  });
});
