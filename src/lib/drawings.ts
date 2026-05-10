import { supabase } from './supabase';
import type { DrawingData, DrawingRow, PixelLayer } from '@/types';

export async function fetchDrawings(): Promise<DrawingRow[]> {
  const { data, error } = await supabase
    .from('drawings')
    .select('id, title, data, created_at, updated_at, group')
    .order('updated_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as DrawingRow[];
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

export async function fetchDrawing(id: string): Promise<DrawingRow> {
  const { data, error } = await supabase
    .from('drawings')
    .select('id, title, data, created_at, updated_at, group')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data as DrawingRow;
}

export async function createDrawing(title: string, width: number, height: number): Promise<DrawingRow> {
  const layer: PixelLayer = {
    id: crypto.randomUUID(),
    name: 'Calque 1',
    pixels: {},
    opacity: 1,
    visible: true,
  };
  const drawingData: DrawingData = { width, height, layers: [layer] };

  const { data, error } = await supabase
    .from('drawings')
    .insert({ title, data: drawingData })
    .select('id, title, data, created_at, updated_at, group')
    .single();

  if (error) throw error;
  return data as DrawingRow;
}

export async function updateDrawingData(id: string, drawingData: DrawingData): Promise<void> {
  const { error } = await supabase
    .from('drawings')
    .update({ data: drawingData, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}
