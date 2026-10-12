import type { HexColor } from '@/types';
import { getShapePixels, expandSymmetry } from '@/routes/Editor/shapePixels';
import type { SymmetryConfig } from '@/routes/Editor/shapePixels';

export type Tool = 'pencil' | 'eraser' | 'fill' | 'eyedropper' | 'circle' | 'square' | 'line' | 'select';
export type ShapeTool = 'circle' | 'square' | 'line';

export function isShapeTool(t: Tool): t is ShapeTool {
  return t === 'circle' || t === 'square' || t === 'line';
}

export function applyShape(
  tool: ShapeTool,
  start: { x: number; y: number },
  end: { x: number; y: number },
  current: Record<string, HexColor>,
  color: HexColor,
  width: number,
  height: number,
  symmetry: SymmetryConfig,
): Record<string, HexColor> {
  const pts = expandSymmetry(getShapePixels(tool, start, end), width, height, symmetry);
  // Retourne `current` tel quel quand la forme ne change rien : l'appelant ne doit pas enregistrer d'historique.
  let next: Record<string, HexColor> | null = null;
  for (const { x, y } of pts) {
    if (x < 0 || y < 0 || x >= width || y >= height) continue;
    const key = `${x},${y}`;
    if (current[key] === color) continue;
    next ??= { ...current };
    next[key] = color;
  }
  return next ?? current;
}
