import { supabase } from './supabase';
import type { Profile } from '@/types';

export const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function parseProfile(row: unknown): Profile {
  if (!isRecord(row) || typeof row.user_id !== 'string' || typeof row.username !== 'string' || typeof row.email !== 'string') {
    throw new Error('Réponse invalide du serveur.');
  }
  return { user_id: row.user_id, username: row.username, email: row.email };
}

export async function fetchMyProfile(): Promise<Profile> {
  const { data, error } = await supabase.rpc('get_my_profile');
  if (error) throw new Error(error.message);
  if (!Array.isArray(data) || data.length === 0) throw new Error('Profil introuvable.');
  return parseProfile(data[0]);
}

export interface UserSuggestion {
  user_id: string;
  username: string;
}

export async function searchUsersByUsernamePrefix(prefix: string, limit = 10): Promise<UserSuggestion[]> {
  const { data, error } = await supabase.rpc('search_users_by_username_prefix', {
    prefix_in: prefix,
    limit_in: limit,
  });
  if (error) {
    if (error.code === '54000') return [];
    throw new Error(error.message);
  }
  if (!Array.isArray(data)) return [];
  return data.flatMap((row) => {
    if (!isRecord(row) || typeof row.user_id !== 'string' || typeof row.username !== 'string') return [];
    return [{ user_id: row.user_id, username: row.username }];
  });
}

export async function updateUsername(newUsername: string): Promise<string> {
  const { data, error } = await supabase.rpc('set_username', { new_username: newUsername });
  if (error) {
    if (error.code === '22023') throw new Error('Pseudo invalide. 3-20 caractères, minuscules, chiffres ou underscore.');
    if (error.code === '23505') throw new Error('Ce pseudo est déjà pris.');
    if (error.code === '42501') throw new Error('Action non autorisée.');
    if (error.code === '54000') throw new Error('Trop de changements de pseudo. Réessayez dans quelques minutes.');
    throw new Error(error.message);
  }
  if (typeof data !== 'string') throw new Error('Réponse invalide du serveur.');
  return data;
}
