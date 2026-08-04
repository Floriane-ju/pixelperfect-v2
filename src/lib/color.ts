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

// Remappe une couleur sur une rampe ordonnée du plus clair au plus sombre :
// pixel clair → premier stop, pixel sombre → dernier stop.
// Rampe vide ou couleur illisible → couleur d'origine.
export function tintFromRamp(color: string, ramp: readonly string[]): string {
  if (ramp.length === 0) return color;

  const [r, g, b] = hexToRgb(color);
  const index = Math.round((1 - relativeLuminance(r, g, b)) * (ramp.length - 1));
  if (!Number.isFinite(index)) return color;

  return ramp[Math.min(Math.max(index, 0), ramp.length - 1)] ?? color;
}
