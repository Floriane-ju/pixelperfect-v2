import type { HexColor } from '@/types';

// Contrast ratio ≤ 1.1 → nearly identical luminance
const CONTRAST_THRESHOLD = 1.1;
// Hue distance < 30° → same color family
const HUE_THRESHOLD = 30;

function hexToRgb(hex: string): [number, number, number] {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}

function relativeLuminance(r: number, g: number, b: number): number {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function wcagContrast(l1: number, l2: number): number {
  const hi = Math.max(l1, l2);
  const lo = Math.min(l1, l2);
  return (hi + 0.05) / (lo + 0.05);
}

// Returns [hue 0-360, saturation 0-1, lightness 0-1]
function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === rn)      h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
  else if (max === gn) h = ((bn - rn) / d + 2) / 6;
  else                 h = ((rn - gn) / d + 4) / 6;
  return [h * 360, s, l];
}

function circularHueDiff(h1: number, h2: number): number {
  const d = Math.abs(h1 - h2);
  return Math.min(d, 360 - d);
}

function shouldMerge(a: HexColor, b: HexColor): boolean {
  const [r1, g1, b1] = hexToRgb(a);
  const [r2, g2, b2] = hexToRgb(b);

  const contrast = wcagContrast(relativeLuminance(r1, g1, b1), relativeLuminance(r2, g2, b2));
  if (contrast > CONTRAST_THRESHOLD) return false;

  const [h1, s1] = rgbToHsl(r1, g1, b1);
  const [h2, s2] = rgbToHsl(r2, g2, b2);

  // Both achromatic (unsaturated) → luminance alone decides
  if (s1 < 0.1 && s2 < 0.1) return true;
  // One chromatic, one not → different families, don't merge
  if (s1 < 0.1 || s2 < 0.1) return false;

  return circularHueDiff(h1, h2) < HUE_THRESHOLD;
}

export function mergeColors(pixels: Record<string, HexColor>): Record<string, HexColor> {
  // Count frequency so the most common color becomes the cluster representative
  const freq = new Map<HexColor, number>();
  for (const c of Object.values(pixels)) freq.set(c, (freq.get(c) ?? 0) + 1);

  const sorted = Array.from(freq.keys()).sort((a, b) => (freq.get(b) ?? 0) - (freq.get(a) ?? 0));

  const palette: HexColor[] = [];
  const mapping = new Map<HexColor, HexColor>();

  for (const color of sorted) {
    const match = palette.find(p => shouldMerge(color, p));
    if (match) {
      mapping.set(color, match);
    } else {
      palette.push(color);
      mapping.set(color, color);
    }
  }

  const result: Record<string, HexColor> = {};
  for (const [key, color] of Object.entries(pixels)) {
    result[key] = mapping.get(color) ?? color;
  }
  return result;
}
