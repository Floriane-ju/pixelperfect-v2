import type { DrawingData, HexColor, PixelLayer } from '@/types';

export const MAX_DIMENSION = 512;
export const MAX_LAYERS = 64;
export const HEX_COLOR_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

export function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export function parseHexColor(v: unknown): HexColor {
  if (typeof v !== 'string' || !HEX_COLOR_RE.test(v)) {
    throw new Error('Invalid DrawingRow: pixel color must be hex string');
  }
  return v as HexColor;
}

export function parsePixelLayer(raw: unknown, maxPixels: number): PixelLayer {
  if (!isRecord(raw)) throw new Error('Invalid DrawingRow: layer must be object');
  const { id, name, pixels, opacity, visible } = raw;
  if (typeof id !== 'string') throw new Error('Invalid DrawingRow: layer.id');
  if (typeof name !== 'string') throw new Error('Invalid DrawingRow: layer.name');
  if (typeof opacity !== 'number' || opacity < 0 || opacity > 1) {
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
    parsedPixels[key] = parseHexColor(value);
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
  return { width, height, layers: layers.map((l) => parsePixelLayer(l, maxPixels)) };
}
