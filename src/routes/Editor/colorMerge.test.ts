import { describe, it, expect } from 'vitest';
import { mergeColors } from './colorMerge';
import type { HexColor } from '@/types';

const hex = (s: string) => s as HexColor;

describe('mergeColors', () => {
  it('returns empty object for empty input', () => {
    expect(mergeColors({})).toEqual({});
  });

  it('preserves distinct colors', () => {
    const pixels = { '0,0': hex('#ff0000'), '1,0': hex('#0000ff') };
    const result = mergeColors(pixels);
    expect(result['0,0']).toBe('#ff0000');
    expect(result['1,0']).toBe('#0000ff');
  });

  it('merges nearly identical achromatic colors', () => {
    const pixels = { '0,0': hex('#808080'), '1,0': hex('#818181') };
    const result = mergeColors(pixels);
    expect(result['0,0']).toBe(result['1,0']);
  });

  it('keeps chromatic colors with same hue together', () => {
    const pixels = { '0,0': hex('#ff2200'), '1,0': hex('#ff1100') };
    const result = mergeColors(pixels);
    expect(result['0,0']).toBe(result['1,0']);
  });

  it('separates chromatically distinct colors', () => {
    const pixels = { '0,0': hex('#ff0000'), '1,0': hex('#00ff00'), '2,0': hex('#0000ff') };
    const result = mergeColors(pixels);
    const values = Object.values(result);
    const uniqueColors = new Set(values);
    expect(uniqueColors.size).toBe(3);
  });

  it('preserves all pixel keys', () => {
    const pixels = { '0,0': hex('#ff0000'), '1,0': hex('#00ff00'), '2,0': hex('#ff0000') };
    const result = mergeColors(pixels);
    expect(Object.keys(result)).toHaveLength(3);
  });

  it('most frequent color wins when merging', () => {
    const pixels = {
      '0,0': hex('#808080'),
      '1,0': hex('#808080'),
      '2,0': hex('#818181'),
    };
    const result = mergeColors(pixels);
    expect(result['2,0']).toBe('#808080');
  });
});
