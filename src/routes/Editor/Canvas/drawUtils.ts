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

// Clé numérique unique pour des coordonnées bornées (hors canvas inclus) : évite une chaîne par pixel empilé.
const KEY_BIAS = 1 << 20;
const KEY_STRIDE = 2 * KEY_BIAS;

/** Tampon carré sans doublon, ordre de première apparition conservé. */
export function stampBrush(pixels: Array<{ x: number; y: number }>, size: number): Array<{ x: number; y: number }> {
  if (size <= 1) return pixels;
  const offset = Math.floor((size - 1) / 2);
  const seen = new Set<number>();
  const out: Array<{ x: number; y: number }> = [];
  for (const { x, y } of pixels) {
    for (let dy = 0; dy < size; dy++) {
      for (let dx = 0; dx < size; dx++) {
        const px = x + dx - offset;
        const py = y + dy - offset;
        const k = (py + KEY_BIAS) * KEY_STRIDE + (px + KEY_BIAS);
        if (seen.has(k)) continue;
        seen.add(k);
        out.push({ x: px, y: py });
      }
    }
  }
  return out;
}

/** Applique crayon ou gomme sur `map` (et sur le canvas du calque si fourni). Retourne true si un pixel a changé. */
export function applyBrushPixels(
  map: Record<string, HexColor>,
  lctx: CanvasRenderingContext2D | null,
  pixels: Array<{ x: number; y: number }>,
  erase: boolean,
  color: HexColor,
  width: number,
  height: number,
): boolean {
  let changed = false;
  for (const { x, y } of pixels) {
    if (x < 0 || y < 0 || x >= width || y >= height) continue;
    const key = `${x},${y}`;
    if (!erase) {
      if (map[key] === color) continue;
      map[key] = color;
      if (lctx) { lctx.fillStyle = color; lctx.fillRect(x, y, 1, 1); }
      changed = true;
    } else if (key in map) {
      delete map[key];
      if (lctx) lctx.clearRect(x, y, 1, 1);
      changed = true;
    }
  }
  return changed;
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
