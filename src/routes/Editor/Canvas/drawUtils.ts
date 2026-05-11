import type { DrawingData, HexColor } from '@/types';

export function pickColorAt(data: DrawingData, px: { x: number; y: number }): HexColor | null {
  if (px.x < 0 || px.y < 0 || px.x >= data.width || px.y >= data.height) return null;
  const key = `${px.x},${px.y}`;
  for (let i = data.layers.length - 1; i >= 0; i--) {
    const layer = data.layers[i];
    if (!layer || !layer.visible) continue;
    const picked = layer.pixels[key];
    if (picked) return picked;
  }
  return null;
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
