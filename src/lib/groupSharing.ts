import { supabase } from './supabase';
import { isRecord } from './drawingValidation';

/**
 * Partage d'un groupe entier. Un groupe n'est pas une entité : il est identifié par le couple
 * (propriétaire, nom). Seul le propriétaire partage, et l'auto-partage des dessins ajoutés au
 * groupe est assuré côté serveur par un trigger sur `drawings."group"` — pas ici.
 *
 * Ces fonctions ne sont atteignables que connecté (cf. `lib/drawingStore`).
 */
export interface GroupMember {
  user_id: string;
  username: string | null;
}

export interface SupabaseErrorLike {
  code?: string;
  message: string;
}

/** Traduit les codes d'erreur des RPC de partage (mêmes codes que `add_collaborator_by_handle`). */
export function shareErrorMessage(error: SupabaseErrorLike): string {
  if (error.code === 'P0002') return 'Aucun utilisateur trouvé avec ce pseudo ou cet email.';
  if (error.code === '42501') return 'Action non autorisée.';
  if (error.code === '54000') return "Trop d'invitations envoyées. Réessayez dans quelques minutes.";
  return error.message;
}

export function parseGroupMembers(data: unknown): GroupMember[] {
  if (!Array.isArray(data)) throw new Error('Réponse invalide du serveur.');
  return data.map((row) => {
    if (!isRecord(row) || typeof row.user_id !== 'string') {
      throw new Error('Invalid group member row');
    }
    return {
      user_id: row.user_id,
      username: typeof row.username === 'string' ? row.username : null,
    };
  });
}

/** Ajoute un membre au groupe et partage rétroactivement les dessins déjà présents. */
export async function shareGroupByHandle(groupName: string, handle: string): Promise<string> {
  const { data, error } = await supabase.rpc('share_group_by_handle', {
    group_name_in: groupName,
    handle_in: handle,
  });
  if (error) throw new Error(shareErrorMessage(error));
  if (typeof data !== 'string') throw new Error('Réponse invalide du serveur.');
  return data;
}

export async function listGroupMembers(groupName: string): Promise<GroupMember[]> {
  const { data, error } = await supabase.rpc('list_group_members', { group_name_in: groupName });
  if (error) throw new Error(shareErrorMessage(error));
  return parseGroupMembers(data);
}

/** Retire le membre du groupe ; les accès hérités du groupe sont révoqués côté serveur. */
export async function removeGroupMember(groupName: string, userId: string): Promise<void> {
  const { error } = await supabase.rpc('remove_group_member', {
    group_name_in: groupName,
    user_id_in: userId,
  });
  if (error) throw new Error(shareErrorMessage(error));
}
