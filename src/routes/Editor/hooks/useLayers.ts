import { useCallback } from 'react';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import type { DrawingData, DrawingRow, HexColor, PixelLayer } from '@/types';

interface UseLayersParams {
  drawing: DrawingRow | null;
  setDrawing: Dispatch<SetStateAction<DrawingRow | null>>;
  activeLayerId: string;
  setActiveLayerId: Dispatch<SetStateAction<string>>;
  scheduleSave: () => void;
  pushHistory: (before: DrawingData) => void;
  latestDataRef: MutableRefObject<DrawingData | null>;
}

export function useLayers({ drawing, setDrawing, setActiveLayerId, scheduleSave, pushHistory, latestDataRef }: UseLayersParams) {
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

  const handleLayerDuplicate = useCallback((layerId: string) => {
    if (latestDataRef.current) pushHistory(latestDataRef.current);
    setDrawing(prev => {
      if (!prev) return prev;
      const src = prev.data.layers.find(l => l.id === layerId);
      if (!src) return prev;
      const clone: PixelLayer = { ...src, id: crypto.randomUUID(), name: `${src.name} copie`, pixels: { ...src.pixels } };
      const idx = prev.data.layers.findIndex(l => l.id === layerId);
      const layers = [...prev.data.layers.slice(0, idx + 1), clone, ...prev.data.layers.slice(idx + 1)];
      return { ...prev, data: { ...prev.data, layers } };
    });
    scheduleSave();
  }, [latestDataRef, pushHistory, setDrawing, scheduleSave]);

  const handleLayerAdd = useCallback(() => {
    if (latestDataRef.current) pushHistory(latestDataRef.current);
    setDrawing(prev => {
      if (!prev) return prev;
      const newLayer: PixelLayer = {
        id: crypto.randomUUID(),
        name: `Calque ${prev.data.layers.length + 1}`,
        pixels: {},
        opacity: 1,
        visible: true,
      };
      const layers = [...prev.data.layers, newLayer];
      setActiveLayerId(newLayer.id);
      return { ...prev, data: { ...prev.data, layers } };
    });
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
    setActiveLayerId(prev => {
      if (prev !== layerId) return prev;
      const remaining = drawing?.data.layers.filter(l => l.id !== layerId) ?? [];
      return remaining[0]?.id ?? '';
    });
    scheduleSave();
  }, [latestDataRef, pushHistory, setDrawing, setActiveLayerId, drawing, scheduleSave]);

  return {
    handleLayerChange,
    handleLayerVisibilityToggle,
    handleLayerDuplicate,
    handleLayerAdd,
    handleLayerDelete,
    handleLayerReorder,
  };
}
