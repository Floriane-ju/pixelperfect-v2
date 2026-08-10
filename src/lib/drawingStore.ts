import { supabase } from './supabase';
import * as remote from './drawings';
import * as local from './localLibrary';
import type { DrawingData, DrawingRow } from '@/types';

/**
 * Couche de dispatch : connecté → Supabase (`lib/drawings`), anonyme → bibliothèque locale
 * IndexedDB (`lib/localLibrary`). Galerie et éditeur passent par ici plutôt que d'appeler
 * directement l'une ou l'autre persistance.
 *
 * Les fonctions de partage (`listCollaborators` dans `lib/drawings`, `lib/groupSharing`) ne sont
 * pas dispatchées : elles ne sont atteignables que connecté.
 */
async function authed(): Promise<boolean> {
  const { data } = await supabase.auth.getSession();
  return data.session !== null;
}

export async function fetchDrawings(): Promise<DrawingRow[]> {
  return (await authed()) ? remote.fetchDrawings() : local.fetchDrawings();
}

export async function fetchDrawing(id: string): Promise<DrawingRow> {
  return (await authed()) ? remote.fetchDrawing(id) : local.fetchDrawing(id);
}

export async function createDrawing(
  title: string,
  width: number,
  height: number,
): Promise<DrawingRow> {
  return (await authed())
    ? remote.createDrawing(title, width, height)
    : local.createDrawing(title, width, height);
}

export async function updateDrawingData(id: string, data: DrawingData): Promise<void> {
  return (await authed()) ? remote.updateDrawingData(id, data) : local.updateDrawingData(id, data);
}

export async function renameDrawing(id: string, title: string): Promise<void> {
  return (await authed()) ? remote.renameDrawing(id, title) : local.renameDrawing(id, title);
}

export async function deleteDrawing(id: string): Promise<void> {
  return (await authed()) ? remote.deleteDrawing(id) : local.deleteDrawing(id);
}

export async function removeFromGroup(id: string): Promise<void> {
  return (await authed()) ? remote.removeFromGroup(id) : local.removeFromGroup(id);
}

export async function moveToGroup(id: string, group: string): Promise<void> {
  return (await authed()) ? remote.moveToGroup(id, group) : local.moveToGroup(id, group);
}

export async function renameGroup(oldName: string, newName: string): Promise<void> {
  return (await authed()) ? remote.renameGroup(oldName, newName) : local.renameGroup(oldName, newName);
}

export async function dissolveGroup(groupName: string): Promise<void> {
  return (await authed()) ? remote.dissolveGroup(groupName) : local.dissolveGroup(groupName);
}
