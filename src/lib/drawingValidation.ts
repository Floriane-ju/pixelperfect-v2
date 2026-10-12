import type { DrawingData, HexColor, PixelLayer } from '@/types';

const MAX_DIMENSION = 512;
export const MAX_LAYERS = 64;
const PIXEL_KEY_RE = /^(\d+),(\d+)$/;
const HEX_COLOR_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

export function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function parseHexColor(v: unknown): HexColor {
  if (typeof v !== 'string' || !HEX_COLOR_RE.test(v)) {
    throw new Error('Invalid DrawingRow: pixel color must be hex string');
  }
  return v as HexColor;
}

/** Clé `x,y` bien formée et dans le cadre (sinon NaN à l'export SVG, ou pixel invisible). */
function isPixelKeyInBounds(key: string, width: number, height: number): boolean {
  const m = PIXEL_KEY_RE.exec(key);
  return m !== null && Number(m[1]) < width && Number(m[2]) < height;
}

export function parsePixelLayer(
  raw: unknown,
  maxPixels: number,
  bounds?: { width: number; height: number },
): PixelLayer {
  if (!isRecord(raw)) throw new Error('Invalid DrawingRow: layer must be object');
  const { id, name, pixels, opacity, visible } = raw;
  if (typeof id !== 'string') throw new Error('Invalid DrawingRow: layer.id');
  if (typeof name !== 'string') throw new Error('Invalid DrawingRow: layer.name');
  if (typeof opacity !== 'number' || !Number.isFinite(opacity) || opacity < 0 || opacity > 1) {
    throw new Error('Invalid DrawingRow: layer.opacity');
  }
  if (typeof visible !== 'boolean') throw new Error('Invalid DrawingRow: layer.visible');
  if (!isRecord(pixels)) throw new Error('Invalid DrawingRow: layer.pixels');
  const entries = Object.entries(pixels);
  if (entries.length > maxPixels) {
    throw new Error(`Invalid DrawingRow: layer.pixels exceeds cap ${maxPixels}`);
  }
  const parsedPixels: Record<string, HexColor> = {};
  for (const [key, value] of entries) {
    const color = parseHexColor(value);
    // Clé invalide ignorée plutôt que rejetée : un seul pixel corrompu ne doit pas rendre le
    // dessin entier illisible.
    if (bounds && !isPixelKeyInBounds(key, bounds.width, bounds.height)) continue;
    parsedPixels[key] = color;
  }
  return { id, name, pixels: parsedPixels, opacity, visible };
}

export function parseDrawingData(raw: unknown): DrawingData {
  if (!isRecord(raw)) throw new Error('Invalid DrawingRow: data must be object');
  const { width, height, layers } = raw;
  if (typeof width !== 'number' || !Number.isInteger(width) || width < 1 || width > MAX_DIMENSION) {
    throw new Error(`Invalid DrawingRow: width must be integer in [1, ${MAX_DIMENSION}]`);
  }
  if (typeof height !== 'number' || !Number.isInteger(height) || height < 1 || height > MAX_DIMENSION) {
    throw new Error(`Invalid DrawingRow: height must be integer in [1, ${MAX_DIMENSION}]`);
  }
  if (!Array.isArray(layers)) throw new Error('Invalid DrawingRow: layers must be array');
  if (layers.length > MAX_LAYERS) {
    throw new Error(`Invalid DrawingRow: layers exceeds cap ${MAX_LAYERS}`);
  }
  const maxPixels = width * height;
  return { width, height, layers: layers.map((l) => parsePixelLayer(l, maxPixels, { width, height })) };
}
