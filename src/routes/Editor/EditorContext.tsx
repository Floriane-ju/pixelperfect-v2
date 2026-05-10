import { createContext, useContext } from 'react';
import type { PixelLayer } from '@/types';
import type { OpenPanel } from './hooks/useColorPalette';

export interface RefImageInfo {
  x: number;
  y: number;
  scale: number;
  opacity: number;
  naturalWidth: number;
  naturalHeight: number;
}

export interface EditorContextValue {
  title: string;
  mirrorH: boolean;
  mirrorV: boolean;
  onMirrorHChange: (v: boolean) => void;
  onMirrorVChange: (v: boolean) => void;
  activeLayerId: string;
  layers: PixelLayer[];
  openPanel: OpenPanel;
  onPanelToggle: (p: 'layers' | 'color' | 'ref') => void;
  onPanelClose: () => void;
  onLayerAdd: () => void;
  onLayerSelect: (id: string) => void;
  onLayerVisibilityToggle: (id: string) => void;
  onLayerDuplicate: (id: string) => void;
  onLayerDelete: (id: string) => void;
  onBack: () => void;
  refImage: RefImageInfo | null;
  onRefImageImport: (file: File) => void;
  onRefImageRemove: () => void;
  onRefImageTransform: (x: number, y: number, scale: number, opacity: number) => void;
  onRefImageCapture: () => void;
  canvasDisplaySize: { w: number; h: number };
  onCopySvg: () => void;
}

const EditorContext = createContext<EditorContextValue | null>(null);

export function useEditorContext(): EditorContextValue {
  const ctx = useContext(EditorContext);
  if (!ctx) throw new Error('useEditorContext must be used within EditorContext.Provider');
  return ctx;
}

export { EditorContext };
