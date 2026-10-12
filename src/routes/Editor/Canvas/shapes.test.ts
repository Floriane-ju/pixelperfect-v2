import { describe, it, expect } from 'vitest';
import { applyShape } from './shapes';
import type { HexColor } from '@/types';

const black = '#000000' as HexColor;
const red = '#ff0000' as HexColor;
const noSymmetry = { axis: 'none', rotation: false, radialSegments: 4 } as const;

describe('applyShape', () => {
  it('returns the same reference when the shape changes nothing', () => {
    const current = { '0,0': red, '1,0': red };
    const out = applyShape('line', { x: 0, y: 0 }, { x: 1, y: 0 }, current, red, 4, 4, noSymmetry);
    expect(out).toBe(current);
  });

  it('returns a new object with the shape painted otherwise', () => {
    const current: Record<string, HexColor> = {};
    const out = applyShape('line', { x: 0, y: 0 }, { x: 1, y: 0 }, current, black, 4, 4, noSymmetry);
    expect(out).not.toBe(current);
    expect(out).toEqual({ '0,0': black, '1,0': black });
    expect(current).toEqual({});
  });
});
