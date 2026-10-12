export function hexToRgb(hex: string): [number, number, number] {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}

// WCAG relative luminance, 0 (noir) → 1 (blanc)
export function relativeLuminance(r: number, g: number, b: number): number {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

// Développe #rgb / #rgba / #rrggbb / #rrggbbaa en [r, g, b, a] (a de 0 à 1).
function parseHex(hex: string): [number, number, number, number] {
  const digits = hex.length <= 5 ? [...hex.slice(1)].map((d) => d + d).join('') : hex.slice(1);
  const [r, g, b] = hexToRgb(`#${digits}`);
  const a = digits.length === 8 ? parseInt(digits.slice(6, 8), 16) / 255 : 1;
  return [r, g, b, a];
}

const LIGHT_THRESHOLD = 0.6;

// Rabat les couleurs claires vers `tone` (le blanc devient `tone`) en rampe linéaire au-dessus
// de LIGHT_THRESHOLD de clarté : les tons clairs gardent leur ordre de luminosité.
export function toneDownLight(hex: string, tone: string): string {
  const [r, g, b, a] = parseHex(hex);
  const lightness = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  const weight = Math.max(0, (lightness - LIGHT_THRESHOLD) / (1 - LIGHT_THRESHOLD));
  const [tr, tg, tb] = hexToRgb(tone);
  const dim = (c: number, t: number) => Math.round(c * (1 - weight * (1 - t / 255)));
  return `rgba(${dim(r, tr)}, ${dim(g, tg)}, ${dim(b, tb)}, ${a})`;
}
