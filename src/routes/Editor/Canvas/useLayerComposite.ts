import { useCallback, useEffect, useRef } from 'react';
import type { RefObject } from 'react';
import type { DrawingData, HexColor } from '@/types';

export type LayerCanvasEntry = { canvas: HTMLCanvasElement; pixelsRef: Record<string, HexColor> };

interface UseLayerCompositeParams {
  mainCanvasRef: RefObject<HTMLCanvasElement>;
  data: DrawingData;
  activeLayerId: string;
}

interface UseLayerCompositeReturn {
  layerCanvasesRef: React.MutableRefObject<Map<string, LayerCanvasEntry>>;
  layerPixelsRef: React.MutableRefObject<Record<string, HexColor>>;
  recompositeMain: () => void;
}

export function useLayerComposite({ mainCanvasRef, data, activeLayerId }: UseLayerCompositeParams): UseLayerCompositeReturn {
  const layerCanvasesRef = useRef<Map<string, LayerCanvasEntry>>(new Map());
  const layerPixelsRef = useRef<Record<string, HexColor>>({});

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
    const layer = data.layers.find(l => l.id === activeLayerId);
    layerPixelsRef.current = layer ? { ...layer.pixels } : {};
  }, [data, activeLayerId]);

  useEffect(() => {
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
      for (const [key, c] of Object.entries(layer.pixels)) {
        const comma = key.indexOf(',');
        ctx.fillStyle = c;
        ctx.fillRect(parseInt(key.slice(0, comma), 10), parseInt(key.slice(comma + 1), 10), 1, 1);
      }
      entry.pixelsRef = layer.pixels;
    }
    for (const id of Array.from(cache.keys())) {
      if (!seen.has(id)) cache.delete(id);
    }
    recompositeMain();
  }, [data, recompositeMain]);

  return { layerCanvasesRef, layerPixelsRef, recompositeMain };
}
