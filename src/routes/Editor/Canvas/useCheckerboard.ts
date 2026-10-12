import { useEffect } from 'react';
import type { RefObject } from 'react';

export function useCheckerboard(canvasRef: RefObject<HTMLCanvasElement | null>, width: number, height: number): void {
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    // Motif 2×2 répété : un seul fillRect au lieu d'un par pixel (262 144 en 512²).
    const tile = document.createElement('canvas');
    tile.width = 2;
    tile.height = 2;
    const tctx = tile.getContext('2d');
    if (!tctx) return;
    tctx.fillStyle = '#b8b8b8';
    tctx.fillRect(0, 0, 2, 2);
    tctx.fillStyle = '#8f8f8f';
    tctx.fillRect(0, 0, 1, 1);
    tctx.fillRect(1, 1, 1, 1);
    const pattern = ctx.createPattern(tile, 'repeat');
    if (!pattern) return;
    ctx.fillStyle = pattern;
    ctx.fillRect(0, 0, width, height);
  }, [canvasRef, width, height]);
}
