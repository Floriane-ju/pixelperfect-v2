import { describe, expect, it } from 'vitest';
import { relativeLuminance, hexToRgb } from './color';

describe('relativeLuminance', () => {
  it('vaut 1 pour le blanc et 0 pour le noir', () => {
    expect(relativeLuminance(...hexToRgb('#FFFFFF'))).toBeCloseTo(1);
    expect(relativeLuminance(...hexToRgb('#000000'))).toBe(0);
  });
});
