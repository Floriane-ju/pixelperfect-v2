import { useCallback, useEffect, useRef } from 'react';
import type { MutableRefObject, RefObject } from 'react';
import type { DrawingData, HexColor } from '@/types';

type LayerCanvasEntry = { canvas: HTMLCanvasElement; pixelsRef: Record<string, HexColor> };

interface UseLayerCompositeParams {
  mainCanvasRef: RefObject<HTMLCanvasElement | null>;
  data: DrawingData;
  activeLayerId: string;
}

interface UseLayerCompositeReturn {
  layerCanvasesRef: MutableRefObject<Map<string, LayerCanvasEntry>>;
  layerPixelsRef: MutableRefObject<Record<string, HexColor>>;
  recompositeMain: () => void;
}

export function useLayerComposite({ mainCanvasRef, data, activeLayerId }: UseLayerCompositeParams): UseLayerCompositeReturn {
  const layerCanvasesRef = useRef<Map<string, LayerCanvasEntry>>(new Map());
  const layerPixelsRef = useRef<Record<string, HexColor>>({});
  const lastLayersRef = useRef<DrawingData['layers'] | null>(null);
  const lastDimsRef = useRef<{ w: number; h: number }>({ w: 0, h: 0 });
  const lastActiveLayerIdRef = useRef<string | null>(null);

  const recompositeMain = useCallback(() => {
    const ctx = mainCanvasRef.current?.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, data.width, data.height);
    for (const layer of data.layers) {
      if (!layer.visible) continue;
      const entry = layerCanvasesRef.current.get(layer.id);
      if (!entry) continue;
      ctx.globalAlpha = layer.opacity;
      ctx.drawImage(entry.canvas, 0, 0);
    }
    ctx.globalAlpha = 1;
  }, [mainCanvasRef, data]);

  useEffect(() => {
    if (lastActiveLayerIdRef.current === activeLayerId && lastLayersRef.current === data.layers) return;
    const layer = data.layers.find(l => l.id === activeLayerId);
    layerPixelsRef.current = layer ? { ...layer.pixels } : {};
    lastActiveLayerIdRef.current = activeLayerId;
  }, [data, activeLayerId]);

  useEffect(() => {
    const sameDims = lastDimsRef.current.w === data.width && lastDimsRef.current.h === data.height;
    if (lastLayersRef.current === data.layers && sameDims) return;

    const cache = layerCanvasesRef.current;
    const seen = new Set<string>();
    for (const layer of data.layers) {
      seen.add(layer.id);
      let entry = cache.get(layer.id);
      const needsResize = entry && (entry.canvas.width !== data.width || entry.canvas.height !== data.height);
      if (entry && entry.pixelsRef === layer.pixels && !needsResize) continue;
      if (!entry) {
        const c = document.createElement('canvas');
        c.width = data.width;
        c.height = data.height;
        entry = { canvas: c, pixelsRef: layer.pixels };
        cache.set(layer.id, entry);
      } else if (needsResize) {
        entry.canvas.width = data.width;
        entry.canvas.height = data.height;
      }
      const ctx = entry.canvas.getContext('2d');
      if (!ctx) continue;
      ctx.clearRect(0, 0, data.width, data.height);
      const pixels = layer.pixels;
      for (const key in pixels) {
        const c = pixels[key];
        if (!c) continue;
        const comma = key.indexOf(',');
        ctx.fillStyle = c;
        ctx.fillRect(parseInt(key.slice(0, comma), 10), parseInt(key.slice(comma + 1), 10), 1, 1);
      }
      entry.pixelsRef = layer.pixels;
    }
    for (const id of Array.from(cache.keys())) {
      if (!seen.has(id)) cache.delete(id);
    }
    lastLayersRef.current = data.layers;
    lastDimsRef.current = { w: data.width, h: data.height };
    recompositeMain();
  }, [data, recompositeMain]);

  return { layerCanvasesRef, layerPixelsRef, recompositeMain };
}
