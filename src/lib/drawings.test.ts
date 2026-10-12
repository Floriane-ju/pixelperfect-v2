import { describe, expect, it, vi, beforeEach } from 'vitest';
import { SaveRejectedError } from './saveErrors';
import type { DrawingData } from '@/types';

/** Seul le réseau est doublé : la chaîne PostgREST renvoie la réponse préparée par le test. */
const updateResult = vi.fn();
const getUser = vi.fn();

vi.mock('./supabase', () => ({
  supabase: {
    from: () => ({
      update: () => ({ eq: () => ({ select: () => updateResult() }) }),
    }),
    auth: { getUser: () => getUser() },
  },
}));

const { updateDrawingData } = await import('./drawings');

const data: DrawingData = { width: 1, height: 1, layers: [] };

beforeEach(() => {
  updateResult.mockReset();
  getUser.mockReset();
});

describe('updateDrawingData', () => {
  it('réussit quand une ligne est modifiée', async () => {
    updateResult.mockResolvedValue({ data: [{ id: 'd1' }], error: null });
    await expect(updateDrawingData('d1', data)).resolves.toBeUndefined();
    expect(getUser).not.toHaveBeenCalled();
  });

  it('refus définitif quand un utilisateur authentifié ne peut pas écrire', async () => {
    updateResult.mockResolvedValue({ data: [], error: null });
    getUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
    await expect(updateDrawingData('d1', data)).rejects.toBeInstanceOf(SaveRejectedError);
  });

  it('échec transitoire (gardé en file) quand la session a expiré', async () => {
    updateResult.mockResolvedValue({ data: [], error: null });
    getUser.mockResolvedValue({ data: { user: null }, error: new Error('expired') });
    const err = await updateDrawingData('d1', data).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(Error);
    expect(err).not.toBeInstanceOf(SaveRejectedError);
  });
});
