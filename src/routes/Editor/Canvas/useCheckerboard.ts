import { useEffect } from 'react';
import type { RefObject } from 'react';

export function useCheckerboard(canvasRef: RefObject<HTMLCanvasElement | null>, width: number, height: number): void {
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        ctx.fillStyle = (x + y) % 2 === 0 ? '#8f8f8f' : '#b8b8b8';
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }, [canvasRef, width, height]);
}
