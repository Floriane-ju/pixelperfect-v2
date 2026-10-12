import type { IconName } from '@/components/Icons';
import type { Tool } from './Canvas/Canvas';
import type { MirrorAxis } from './shapePixels';

export interface ToolDef {
  tool: Tool;
  icon: IconName;
  label: string;
  /** Infobulle si elle diffère du libellé (raccourci clavier). */
  title?: string;
  /** Outil qui utilise la taille du pinceau (badge + appui long). */
  sized?: boolean;
}

export const TOOLS: readonly ToolDef[] = [
  { tool: 'pencil', icon: 'pen', label: 'Crayon', title: 'Crayon (P) — appui long : taille', sized: true },
  { tool: 'eraser', icon: 'erase', label: 'Gomme', title: 'Gomme (E) — appui long : taille', sized: true },
  { tool: 'fill', icon: 'fill', label: 'Pot de peinture', title: 'Pot de peinture (F)' },
  { tool: 'eyedropper', icon: 'pipette', label: 'Pipette', title: 'Pipette (K)' },
  { tool: 'select', icon: 'select', label: 'Sélection rectangulaire', title: 'Sélection rectangulaire (S)' },
  { tool: 'line', icon: 'line', label: 'Ligne', title: 'Ligne (L)' },
  { tool: 'square', icon: 'rect', label: 'Rectangle', title: 'Rectangle (R)' },
  { tool: 'circle', icon: 'circle', label: 'Ellipse', title: 'Ellipse (O)' },
];

export const BRUSH_MIN = 1;
export const BRUSH_MAX = 16;

export function toolDef(tool: Tool): ToolDef | undefined {
  return TOOLS.find((t) => t.tool === tool);
}

const AXIS_LABELS: Record<MirrorAxis, string> = {
  none: 'Aucune',
  horizontal: 'Horizontale',
  vertical: 'Verticale',
  radial: 'Radiale',
};

export function mirrorLabel(axis: MirrorAxis, rotation: boolean, segments: number): string {
  if (axis === 'none') return AXIS_LABELS.none;
  const base = axis === 'radial' ? `${AXIS_LABELS.radial} · ${segments}` : AXIS_LABELS[axis];
  return rotation ? `${base} · rotation` : base;
}
