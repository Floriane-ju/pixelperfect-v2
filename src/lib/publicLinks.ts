import { supabase } from './supabase';
import { isRecord, parseDrawingData } from './drawingValidation';
import type { DrawingData } from '@/types';

/**
 * Lien public en lecture seule (connecté uniquement) : `drawings.share_token` non nul rend le
 * dessin consultable via `/p/<token>`. Seul le propriétaire peut le changer (trigger
 * `guard_share_token`), la lecture publique passe par la RPC `get_public_drawing`.
 */

export interface PublicDrawing {
  title: string;
  data: DrawingData;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isShareToken(v: unknown): v is string {
  return typeof v === 'string' && UUID_RE.test(v);
}

export function publicUrl(token: string): string {
  return new URL(`${import.meta.env.BASE_URL}p/${token}`, window.location.origin).href;
}

export async function fetchShareToken(drawingId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('drawings')
    .select('share_token')
    .eq('id', drawingId)
    .single();
  if (error) throw error;
  const token: unknown = isRecord(data) ? data.share_token : null;
  return isShareToken(token) ? token : null;
}

/** Publie (nouveau jeton) ou retire le lien. Rend le jeton en place. */
export async function setPublicLink(drawingId: string, enabled: boolean): Promise<string | null> {
  const token = enabled ? crypto.randomUUID() : null;
  const { data, error } = await supabase
    .from('drawings')
    .update({ share_token: token })
    .eq('id', drawingId)
    .select('id');
  if (error) throw new Error(error.code === '42501' ? 'Action non autorisée.' : error.message);
  if (!data || data.length === 0) throw new Error('Dessin introuvable ou accès retiré.');
  return token;
}

export function parsePublicDrawing(raw: unknown): PublicDrawing | null {
  const row: unknown = Array.isArray(raw) ? raw[0] : raw;
  if (row === undefined || row === null) return null;
  if (!isRecord(row) || typeof row.title !== 'string') throw new Error('Réponse invalide du serveur.');
  return { title: row.title, data: parseDrawingData(row.data) };
}

/** `null` : lien inconnu ou désactivé. */
export async function fetchPublicDrawing(token: string): Promise<PublicDrawing | null> {
  if (!isShareToken(token)) return null;
  const { data, error } = await supabase.rpc('get_public_drawing', { token_in: token });
  if (error) throw error;
  return parsePublicDrawing(data);
}
