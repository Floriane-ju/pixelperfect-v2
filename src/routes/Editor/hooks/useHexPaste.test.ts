import { describe, it, expect } from 'vitest';
import { parsePastedHex } from './useHexPaste';

describe('parsePastedHex', () => {
  it('normalise en #rrggbb minuscule', () => {
    expect(parsePastedHex('#FF0000')).toBe('#ff0000');
    expect(parsePastedHex('  00ff00 ')).toBe('#00ff00');
  });

  it('étend la forme courte et ignore l’alpha', () => {
    expect(parsePastedHex('#ABC')).toBe('#aabbcc');
    expect(parsePastedHex('#abcd')).toBe('#aabbcc');
    expect(parsePastedHex('#11223344')).toBe('#112233');
  });

  it('rejette ce qui n’est pas une couleur', () => {
    expect(parsePastedHex('hello')).toBeNull();
    expect(parsePastedHex('#12345')).toBeNull();
    expect(parsePastedHex('')).toBeNull();
  });
});
