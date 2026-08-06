import { useEffect } from 'react';
import type { RefObject } from 'react';
import type { DrawingData, HexColor } from '@/types';

interface UseHighlightOverlayParams {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  hoveredColor: HexColor | null | undefined;
  data: DrawingData;
  displaySize: { w: number; h: number };
}

export function useHighlightOverlay({ canvasRef, hoveredColor, data, displaySize }: UseHighlightOverlayParams): void {
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!hoveredColor) return;
    const pxSize = displaySize.w / data.width;
    const radius = pxSize * 0.1;
    const r = parseInt(hoveredColor.slice(1, 3), 16) / 255;
    const g = parseInt(hoveredColor.slice(3, 5), 16) / 255;
    const b = parseInt(hoveredColor.slice(5, 7), 16) / 255;
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    ctx.fillStyle = lum > 0.5 ? 'rgba(0,0,0,0.9)' : 'rgba(255,255,255,0.9)';
    for (const layer of data.layers) {
      if (!layer.visible) continue;
      for (const [key, c] of Object.entries(layer.pixels)) {
        if (c !== hoveredColor) continue;
        const comma = key.indexOf(',');
        const px = parseInt(key.slice(0, comma), 10);
        const py = parseInt(key.slice(comma + 1), 10);
        ctx.beginPath();
        ctx.arc((px + 0.5) * pxSize, (py + 0.5) * pxSize, radius, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }, [canvasRef, hoveredColor, data, displaySize]);
}
