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
  const next = { ...current };
  for (const { x, y } of pts) {
    if (x >= 0 && y >= 0 && x < width && y < height) next[`${x},${y}`] = color;
  }
  return next;
}
