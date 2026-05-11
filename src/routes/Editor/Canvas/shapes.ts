import type { HexColor } from '@/types';
import { getShapePixels, expandMirror } from '@/routes/Editor/shapePixels';

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
  mirrorH: boolean,
  mirrorV: boolean,
): Record<string, HexColor> {
  const pts = expandMirror(getShapePixels(tool, start, end), width, height, mirrorH, mirrorV);
  const next = { ...current };
  for (const { x, y } of pts) {
    if (x >= 0 && y >= 0 && x < width && y < height) next[`${x},${y}`] = color;
  }
  return next;
}
