import { describe, expect, it } from 'vitest';
import { findDropTarget } from './useDragReorder';

const spans = [
  { id: 'a', start: 0, end: 10 },
  { id: 'b', start: 20, end: 30 },
  { id: 'c', start: 40, end: 50 },
];

describe('findDropTarget', () => {
  it('cible la première moitié de l’élément survolé comme « avant »', () => {
    expect(findDropTarget(spans, 22, 'a')).toEqual({ targetId: 'b', pos: 'before' });
  });

  it('cible la seconde moitié comme « après »', () => {
    expect(findDropTarget(spans, 28, 'a')).toEqual({ targetId: 'b', pos: 'after' });
  });

  it('ignore l’élément déplacé', () => {
    expect(findDropTarget(spans, 25, 'b')).toEqual({ targetId: null, pos: 'before' });
  });

  it('borne aux extrémités hors de la liste', () => {
    expect(findDropTarget(spans, -5, 'b')).toEqual({ targetId: 'a', pos: 'before' });
    expect(findDropTarget(spans, 99, 'b')).toEqual({ targetId: 'c', pos: 'after' });
  });

  it('ne cible rien dans un interstice', () => {
    expect(findDropTarget(spans, 15, 'c')).toEqual({ targetId: null, pos: 'before' });
  });
});
