import { supabase } from './supabase';
import type { DrawingData, DrawingRow, HexColor, PixelLayer } from '@/types';

const MAX_DIMENSION = 512;
const HEX_COLOR_RE = /^#[0-9a-fA-F]{3,8}$/;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function parseHexColor(v: unknown): HexColor {
  if (typeof v !== 'string' || !HEX_COLOR_RE.test(v)) {
    throw new Error('Invalid DrawingRow: pixel color must be hex string');
  }
  return v as HexColor;
}

function parsePixelLayer(raw: unknown): PixelLayer {
  if (!isRecord(raw)) throw new Error('Invalid DrawingRow: layer must be object');
  const { id, name, pixels, opacity, visible } = raw;
  if (typeof id !== 'string') throw new Error('Invalid DrawingRow: layer.id');
  if (typeof name !== 'string') throw new Error('Invalid DrawingRow: layer.name');
  if (typeof opacity !== 'number' || opacity < 0 || opacity > 1) {
    throw new Error('Invalid DrawingRow: layer.opacity');
  }
  if (typeof visible !== 'boolean') throw new Error('Invalid DrawingRow: layer.visible');
  if (!isRecord(pixels)) throw new Error('Invalid DrawingRow: layer.pixels');
  const parsedPixels: Record<string, HexColor> = {};
  for (const [key, value] of Object.entries(pixels)) {
    parsedPixels[key] = parseHexColor(value);
  }
  return { id, name, pixels: parsedPixels, opacity, visible };
}

function parseDrawingData(raw: unknown): DrawingData {
  if (!isRecord(raw)) throw new Error('Invalid DrawingRow: data must be object');
  const { width, height, layers } = raw;
  if (typeof width !== 'number' || !Number.isInteger(width) || width < 1 || width > MAX_DIMENSION) {
    throw new Error(`Invalid DrawingRow: width must be integer in [1, ${MAX_DIMENSION}]`);
  }
  if (typeof height !== 'number' || !Number.isInteger(height) || height < 1 || height > MAX_DIMENSION) {
    throw new Error(`Invalid DrawingRow: height must be integer in [1, ${MAX_DIMENSION}]`);
  }
  if (!Array.isArray(layers)) throw new Error('Invalid DrawingRow: layers must be array');
  return { width, height, layers: layers.map(parsePixelLayer) };
}

function parseDrawingRow(raw: unknown): DrawingRow {
  if (!isRecord(raw)) throw new Error('Invalid DrawingRow: row must be object');
  const { id, title, data, created_at, updated_at, group } = raw;
  if (typeof id !== 'string') throw new Error('Invalid DrawingRow: id');
  if (typeof title !== 'string') throw new Error('Invalid DrawingRow: title');
  if (typeof created_at !== 'string') throw new Error('Invalid DrawingRow: created_at');
  if (typeof updated_at !== 'string') throw new Error('Invalid DrawingRow: updated_at');
  if (group !== null && typeof group !== 'string') throw new Error('Invalid DrawingRow: group');
  return { id, title, data: parseDrawingData(data), created_at, updated_at, group };
}

export async function fetchDrawings(): Promise<DrawingRow[]> {
  const { data, error } = await supabase
    .from('drawings')
    .select('id, title, data, created_at, updated_at, group')
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
    .select('id, title, data, created_at, updated_at, group')
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
