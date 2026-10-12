import { describe, expect, it } from 'vitest';
import { isShareToken, parsePublicDrawing } from './publicLinks';

const DATA = { width: 2, height: 2, layers: [{ id: 'l1', name: 'Calque 1', pixels: { '0,0': '#ff0000' }, opacity: 1, visible: true }] };

describe('parsePublicDrawing', () => {
  it('lit la première ligne de la RPC', () => {
    const parsed = parsePublicDrawing([{ title: 'Chat', data: DATA }]);
    expect(parsed?.title).toBe('Chat');
    expect(parsed?.data.layers[0]?.pixels['0,0']).toBe('#ff0000');
  });

  it('rend null sans ligne (lien désactivé ou inconnu)', () => {
    expect(parsePublicDrawing([])).toBeNull();
    expect(parsePublicDrawing(null)).toBeNull();
  });

  it('rejette une ligne malformée', () => {
    expect(() => parsePublicDrawing([{ data: DATA }])).toThrow('Réponse invalide du serveur.');
    expect(() => parsePublicDrawing([{ title: 'x', data: { width: 'a' } }])).toThrow();
  });
});

describe('isShareToken', () => {
  it('n’accepte qu’un uuid', () => {
    expect(isShareToken('3f2504e0-4f89-11d3-9a0c-0305e82c3301')).toBe(true);
    expect(isShareToken('../editor')).toBe(false);
    expect(isShareToken(null)).toBe(false);
  });
});
