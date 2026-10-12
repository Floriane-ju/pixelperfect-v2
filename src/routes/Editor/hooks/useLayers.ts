import { useCallback } from 'react';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import { MAX_LAYERS } from '@/lib/drawingValidation';
import type { DrawingData, DrawingRow, HexColor, PixelLayer } from '@/types';
import { resizeLayers } from '../resizeLayers';

interface UseLayersParams {
  setDrawing: Dispatch<SetStateAction<DrawingRow | null>>;
  setActiveLayerId: Dispatch<SetStateAction<string>>;
  scheduleSave: () => void;
  pushHistory: (before: DrawingData) => void;
  latestDataRef: MutableRefObject<DrawingData | null>;
}

export function useLayers({ setDrawing, setActiveLayerId, scheduleSave, pushHistory, latestDataRef }: UseLayersParams) {
  const handleLayerChange = useCallback(
    (layerId: string, pixels: Record<string, HexColor>) => {
      setDrawing(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          data: { ...prev.data, layers: prev.data.layers.map(l => l.id === layerId ? { ...l, pixels } : l) },
        };
      });
      scheduleSave();
    },
    [setDrawing, scheduleSave]
  );

  const handleLayerVisibilityToggle = useCallback((layerId: string) => {
    if (latestDataRef.current) pushHistory(latestDataRef.current);
    setDrawing(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        data: { ...prev.data, layers: prev.data.layers.map(l => l.id === layerId ? { ...l, visible: !l.visible } : l) },
      };
    });
    scheduleSave();
  }, [latestDataRef, pushHistory, setDrawing, scheduleSave]);

  // Au-delà de MAX_LAYERS, parseDrawingData rejette le dessin au rechargement (illisible).
  const handleLayerDuplicate = useCallback((layerId: string) => {
    if (!latestDataRef.current || latestDataRef.current.layers.length >= MAX_LAYERS) return;
    pushHistory(latestDataRef.current);
    const cloneId = crypto.randomUUID();
    setDrawing(prev => {
      if (!prev) return prev;
      const src = prev.data.layers.find(l => l.id === layerId);
      if (!src) return prev;
      const clone: PixelLayer = { ...src, id: cloneId, name: `${src.name} copie`, pixels: { ...src.pixels } };
      const idx = prev.data.layers.findIndex(l => l.id === layerId);
      const layers = [...prev.data.layers.slice(0, idx + 1), clone, ...prev.data.layers.slice(idx + 1)];
      return { ...prev, data: { ...prev.data, layers } };
    });
    scheduleSave();
  }, [latestDataRef, pushHistory, setDrawing, scheduleSave]);

  const handleLayerAdd = useCallback(() => {
    if (!latestDataRef.current || latestDataRef.current.layers.length >= MAX_LAYERS) return;
    pushHistory(latestDataRef.current);
    // Id et setActiveLayerId hors de l'updater : il doit rester pur (rejoué en StrictMode).
    const newId = crypto.randomUUID();
    setDrawing(prev => {
      if (!prev) return prev;
      const newLayer: PixelLayer = {
        id: newId,
        name: `Calque ${prev.data.layers.length + 1}`,
        pixels: {},
        opacity: 1,
        visible: true,
      };
      const layers = [...prev.data.layers, newLayer];
      return { ...prev, data: { ...prev.data, layers } };
    });
    setActiveLayerId(newId);
    scheduleSave();
  }, [latestDataRef, pushHistory, setDrawing, setActiveLayerId, scheduleSave]);

  const handleLayerReorder = useCallback((fromId: string, toId: string, position: 'before' | 'after') => {
    if (fromId === toId) return;
    if (latestDataRef.current) pushHistory(latestDataRef.current);
    setDrawing(prev => {
      if (!prev) return prev;
      const layers = [...prev.data.layers];
      const fromIdx = layers.findIndex(l => l.id === fromId);
      const toIdx = layers.findIndex(l => l.id === toId);
      if (fromIdx < 0 || toIdx < 0) return prev;
      const [moved] = layers.splice(fromIdx, 1);
      if (!moved) return prev;
      let insertIdx = layers.findIndex(l => l.id === toId);
      if (insertIdx < 0) insertIdx = layers.length;
      if (position === 'after') insertIdx += 1;
      layers.splice(insertIdx, 0, moved);
      return { ...prev, data: { ...prev.data, layers } };
    });
    scheduleSave();
  }, [latestDataRef, pushHistory, setDrawing, scheduleSave]);

  const handleLayerDelete = useCallback((layerId: string) => {
    if (latestDataRef.current) pushHistory(latestDataRef.current);
    setDrawing(prev => {
      if (!prev || prev.data.layers.length <= 1) return prev;
      return { ...prev, data: { ...prev.data, layers: prev.data.layers.filter(l => l.id !== layerId) } };
    });
    // Calque actif supprimé : useEditorDrawing retombe sur le calque du dessus.
    scheduleSave();
  }, [latestDataRef, pushHistory, setDrawing, scheduleSave]);

  const handleCanvasResize = useCallback((width: number, height: number) => {
    const current = latestDataRef.current;
    if (!current || (current.width === width && current.height === height)) return;
    pushHistory(current);
    setDrawing(prev => {
      if (!prev) return prev;
      return { ...prev, data: { ...prev.data, width, height, layers: resizeLayers(prev.data.layers, width, height) } };
    });
    scheduleSave();
  }, [latestDataRef, pushHistory, setDrawing, scheduleSave]);

  return {
    handleLayerChange,
    handleCanvasResize,
    handleLayerVisibilityToggle,
    handleLayerDuplicate,
    handleLayerAdd,
    handleLayerDelete,
    handleLayerReorder,
  };
}
