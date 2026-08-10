import { describe, expect, it } from 'vitest';
import { parseGroupMembers, shareErrorMessage } from './groupSharing';

describe('parseGroupMembers', () => {
  it('mappe les lignes valides', () => {
    expect(
      parseGroupMembers([
        { user_id: 'u1', username: 'alice' },
        { user_id: 'u2', username: 'bob' },
      ]),
    ).toEqual([
      { user_id: 'u1', username: 'alice' },
      { user_id: 'u2', username: 'bob' },
    ]);
  });

  it('tolère un username absent ou nul', () => {
    expect(parseGroupMembers([{ user_id: 'u1', username: null }, { user_id: 'u2' }])).toEqual([
      { user_id: 'u1', username: null },
      { user_id: 'u2', username: null },
    ]);
  });

  it('rejette une réponse qui n’est pas un tableau', () => {
    expect(() => parseGroupMembers(null)).toThrow('Réponse invalide du serveur.');
    expect(() => parseGroupMembers({ user_id: 'u1' })).toThrow('Réponse invalide du serveur.');
  });

  it('rejette une ligne sans user_id exploitable', () => {
    expect(() => parseGroupMembers([{ username: 'alice' }])).toThrow('Invalid group member row');
    expect(() => parseGroupMembers([{ user_id: 42 }])).toThrow('Invalid group member row');
  });
});

describe('shareErrorMessage', () => {
  it('traduit les codes connus', () => {
    expect(shareErrorMessage({ code: 'P0002', message: 'no rows' })).toBe(
      'Aucun utilisateur trouvé avec ce pseudo ou cet email.',
    );
    expect(shareErrorMessage({ code: '42501', message: 'denied' })).toBe('Action non autorisée.');
    expect(shareErrorMessage({ code: '54000', message: 'rate' })).toBe(
      "Trop d'invitations envoyées. Réessayez dans quelques minutes.",
    );
  });

  it('retombe sur le message brut pour un code inconnu', () => {
    expect(shareErrorMessage({ code: 'XX000', message: 'boom' })).toBe('boom');
    expect(shareErrorMessage({ message: 'boom' })).toBe('boom');
  });
});
