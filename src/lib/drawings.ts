import { supabase } from './supabase';
import { isRecord, parseDrawingData } from './drawingValidation';
import type { CollaboratorRole, DrawingData, DrawingRow, PixelLayer } from '@/types';

function parseCollaboratorCount(raw: unknown): number {
  if (!Array.isArray(raw) || raw.length === 0) return 0;
  const first = raw[0];
  if (!isRecord(first) || typeof first.count !== 'number') return 0;
  return first.count;
}

function parseDrawingRow(raw: unknown): DrawingRow {
  if (!isRecord(raw)) throw new Error('Invalid DrawingRow: row must be object');
  const { id, title, data, created_at, updated_at, group, owner_id, drawing_users } = raw;
  if (typeof id !== 'string') throw new Error('Invalid DrawingRow: id');
  if (typeof title !== 'string') throw new Error('Invalid DrawingRow: title');
  if (typeof created_at !== 'string') throw new Error('Invalid DrawingRow: created_at');
  if (typeof updated_at !== 'string') throw new Error('Invalid DrawingRow: updated_at');
  if (group !== null && typeof group !== 'string') throw new Error('Invalid DrawingRow: group');
  if (typeof owner_id !== 'string') throw new Error('Invalid DrawingRow: owner_id');
  return {
    id,
    title,
    data: parseDrawingData(data),
    created_at,
    updated_at,
    group,
    owner_id,
    collaborator_count: parseCollaboratorCount(drawing_users),
  };
}

export async function fetchDrawings(): Promise<DrawingRow[]> {
  const { data, error } = await supabase
    .from('drawings')
    .select('id, title, data, created_at, updated_at, group, owner_id, drawing_users(count)')
    .order('updated_at', { ascending: false });

  if (error) throw error;
  return (data ?? []).map(parseDrawingRow);
}

export async function renameDrawing(id: string, title: string): Promise<void> {
  const { error } = await supabase
    .from('drawings')
    .update({ title, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function deleteDrawing(id: string): Promise<void> {
  const { error } = await supabase.from('drawings').delete().eq('id', id);
  if (error) throw error;
}

export async function removeFromGroup(id: string): Promise<void> {
  const { error } = await supabase
    .from('drawings')
    .update({ group: null, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function moveToGroup(id: string, group: string): Promise<void> {
  const { error } = await supabase
    .from('drawings')
    .update({ group, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function renameGroup(oldName: string, newName: string): Promise<void> {
  const { error } = await supabase
    .from('drawings')
    .update({ group: newName, updated_at: new Date().toISOString() })
    .eq('group', oldName);
  if (error) throw error;
}

export async function fetchDrawing(id: string): Promise<DrawingRow> {
  const { data, error } = await supabase
    .from('drawings')
    .select('id, title, data, created_at, updated_at, group, owner_id, drawing_users(count)')
    .eq('id', id)
    .single();
  if (error) throw error;
  return parseDrawingRow(data);
}

export async function createDrawing(title: string, width: number, height: number): Promise<DrawingRow> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!userData.user) throw new Error('Utilisateur non authentifié');

  const layer: PixelLayer = {
    id: crypto.randomUUID(),
    name: 'Calque 1',
    pixels: {},
    opacity: 1,
    visible: true,
  };
  const drawingData: DrawingData = { width, height, layers: [layer] };

  const id = crypto.randomUUID();
  const { error } = await supabase
    .from('drawings')
    .insert({ id, title, data: drawingData });

  if (error) {
    throw new Error(`${error.message}${error.details ? ` — ${error.details}` : ''}${error.hint ? ` (${error.hint})` : ''}`);
  }
  return fetchDrawing(id);
}

export async function updateDrawingData(id: string, drawingData: DrawingData): Promise<void> {
  const { error } = await supabase
    .from('drawings')
    .update({ data: drawingData, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function removeCollaborator(drawingId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('drawing_users')
    .delete()
    .eq('drawing_id', drawingId)
    .eq('user_id', userId);
  if (error) throw error;
}

export interface CollaboratorInfo {
  user_id: string;
  username: string | null;
  role: CollaboratorRole;
}

function parseRole(v: unknown): CollaboratorRole {
  if (v === 'owner' || v === 'editor') return v;
  throw new Error('Invalid collaborator row: role');
}

export async function listCollaborators(drawingId: string): Promise<CollaboratorInfo[]> {
  const { data, error } = await supabase.rpc('list_collaborators', { d_id: drawingId });
  if (error) throw error;
  if (!Array.isArray(data)) throw new Error('Réponse invalide du serveur.');
  return data.map((row) => {
    if (!isRecord(row) || typeof row.user_id !== 'string') {
      throw new Error('Invalid collaborator row');
    }
    const username = typeof row.username === 'string' ? row.username : null;
    return { user_id: row.user_id, username, role: parseRole(row.role) };
  });
}

export async function addCollaboratorByHandle(drawingId: string, handle: string): Promise<string> {
  const { data, error } = await supabase.rpc('add_collaborator_by_handle', {
    d_id: drawingId,
    handle_in: handle,
  });
  if (error) {
    if (error.code === 'P0002') throw new Error('Aucun utilisateur trouvé avec ce pseudo ou cet email.');
    if (error.code === '42501') throw new Error('Action non autorisée.');
    if (error.code === '54000') throw new Error("Trop d'invitations envoyées. Réessayez dans quelques minutes.");
    throw new Error(error.message);
  }
  if (typeof data !== 'string') throw new Error('Réponse invalide du serveur.');
  return data;
}
