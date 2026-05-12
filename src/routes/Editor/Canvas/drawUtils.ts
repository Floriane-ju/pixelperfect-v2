import type { HexColor } from '@/types';

const HEX2 = (n: number): string => n.toString(16).padStart(2, '0');

export function pickColorAt(
  mainCanvas: HTMLCanvasElement | null,
  px: { x: number; y: number },
  width: number,
  height: number,
): HexColor | null {
  if (!mainCanvas) return null;
  if (px.x < 0 || px.y < 0 || px.x >= width || px.y >= height) return null;
  const ctx = mainCanvas.getContext('2d');
  if (!ctx) return null;
  const { data: rgba } = ctx.getImageData(px.x, px.y, 1, 1);
  const a = rgba[3] ?? 0;
  if (a === 0) return null;
  return `#${HEX2(rgba[0] ?? 0)}${HEX2(rgba[1] ?? 0)}${HEX2(rgba[2] ?? 0)}` as HexColor;
}

export function stampBrush(pixels: Array<{ x: number; y: number }>, size: number): Array<{ x: number; y: number }> {
  if (size <= 1) return pixels;
  const offset = Math.floor((size - 1) / 2);
  const out: Array<{ x: number; y: number }> = [];
  for (const { x, y } of pixels) {
    for (let dy = 0; dy < size; dy++) {
      for (let dx = 0; dx < size; dx++) {
        out.push({ x: x + dx - offset, y: y + dy - offset });
      }
    }
  }
  return out;
}

export function restoreLayerFromSnapshot(
  snapshot: Record<string, HexColor>,
  layerCanvas: HTMLCanvasElement,
  width: number,
  height: number,
): void {
  const ctx = layerCanvas.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, width, height);
  for (const [key, c] of Object.entries(snapshot)) {
    const comma = key.indexOf(',');
    ctx.fillStyle = c;
    ctx.fillRect(parseInt(key.slice(0, comma), 10), parseInt(key.slice(comma + 1), 10), 1, 1);
  }
}
