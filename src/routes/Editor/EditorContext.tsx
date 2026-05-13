import { createContext } from 'react';
import type { PixelLayer } from '@/types';
import type { OpenPanel } from './hooks/useColorPalette';
import type { Tool } from './Canvas/Canvas';
import type { RefImageState } from './hooks/useReferenceImage';

export type RefImageInfo = Omit<RefImageState, 'src'>;

export interface EditorContextValue {
  title: string;
  tool: Tool;
  onToolChange: (t: Tool) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  activeLayerId: string;
  layers: PixelLayer[];
  canvasWidth: number;
  canvasHeight: number;
  openPanel: OpenPanel;
  onPanelToggle: (p: 'layers' | 'color' | 'ref' | 'export') => void;
  onPanelClose: () => void;
  onLayerAdd: () => void;
  onLayerSelect: (id: string) => void;
  onLayerVisibilityToggle: (id: string) => void;
  onLayerDuplicate: (id: string) => void;
  onLayerDelete: (id: string) => void;
  onLayerReorder: (fromId: string, toId: string, position: 'before' | 'after') => void;
  onBack: () => void;
  refImage: RefImageInfo | null;
  refImageError: string | null;
  onRefImageImport: (file: File) => void;
  onRefImageErrorClear: () => void;
  onRefImageRemove: () => void;
  onRefImageTransform: (x: number, y: number, scale: number, opacity: number) => void;
  onRefImageCapture: () => void;
  canvasDisplaySize: { w: number; h: number };
  onCopySvg: () => void;
  onCopyPng: () => void;
}

export const EditorContext = createContext<EditorContextValue | null>(null);
