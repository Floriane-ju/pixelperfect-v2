import type { HexColor } from '@/types';

export function bresenham(x0: number, y0: number, x1: number, y1: number): Array<{ x: number; y: number }> {
  const pts: Array<{ x: number; y: number }> = [];
  const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx - dy, cx = x0, cy = y0;
  while (true) {
    pts.push({ x: cx, y: cy });
    if (cx === x1 && cy === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; cx += sx; }
    if (e2 < dx) { err += dx; cy += sy; }
  }
  return pts;
}

export function floodFill(
  pixels: Record<string, HexColor>,
  sx: number, sy: number,
  width: number, height: number,
  fillColor: HexColor,
): Record<string, HexColor> | null {
  const targetColor = pixels[`${sx},${sy}`];
  if (targetColor === fillColor) return null;
  const next = { ...pixels };
  const queue: Array<[number, number]> = [[sx, sy]];
  const visited = new Set<string>([`${sx},${sy}`]);
  let head = 0;
  while (head < queue.length) {
    const [x, y] = queue[head++]!;
    next[`${x},${y}`] = fillColor;
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const nk = `${nx},${ny}`;
      if (visited.has(nk) || pixels[nk] !== targetColor) continue;
      visited.add(nk);
      queue.push([nx, ny]);
    }
  }
  return next;
}

export function getRectPixels(x0: number, y0: number, x1: number, y1: number): Array<{ x: number; y: number }> {
  const mnX = Math.min(x0, x1), mxX = Math.max(x0, x1);
  const mnY = Math.min(y0, y1), mxY = Math.max(y0, y1);
  const pts: Array<{ x: number; y: number }> = [];
  for (let x = mnX; x <= mxX; x++) {
    pts.push({ x, y: mnY }, { x, y: mxY });
  }
  for (let y = mnY + 1; y < mxY; y++) {
    pts.push({ x: mnX, y }, { x: mxX, y });
  }
  return pts;
}

/**
 * Ellipse inscrite dans la bbox inclusive (x0,y0)-(x1,y1). Le centre est un demi-entier quand
 * la largeur (ou hauteur) est paire en nombre de pixels : les décalages suivent alors la même
 * parité (0.5 ou 0) pour que chaque pixel tombe sur un entier, sans arrondi asymétrique.
 */
export function getEllipsePixels(x0: number, y0: number, x1: number, y1: number): Array<{ x: number; y: number }> {
  const minX = Math.min(x0, x1), maxX = Math.max(x0, x1);
  const minY = Math.min(y0, y1), maxY = Math.max(y0, y1);
  const w = maxX - minX, h = maxY - minY;
  const pts: Array<{ x: number; y: number }> = [];

  if (w === 0 || h === 0) {
    for (let x = minX; x <= maxX; x++) for (let y = minY; y <= maxY; y++) pts.push({ x, y });
    return pts;
  }

  const seen = new Set<string>();
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const rx = w / 2, ry = h / 2;
  const startX = w % 2 === 1 ? 0.5 : 0;
  const startY = h % 2 === 1 ? 0.5 : 0;
  const add = (px: number, py: number) => {
    const k = `${px},${py}`;
    if (!seen.has(k)) { seen.add(k); pts.push({ x: px, y: py }); }
  };
  let minMidX = rx;
  const addSymmetric = (dx: number, dy: number) => {
    if (dy === startY && dx < minMidX) minMidX = dx;
    add(cx + dx, cy + dy);
    add(cx - dx, cy + dy);
    add(cx + dx, cy - dy);
    add(cx - dx, cy - dy);
  };

  const rx2 = rx * rx, ry2 = ry * ry;
  let x = startX, y = ry;
  let p1 = ry2 * (x + 1) * (x + 1) + rx2 * (y - 0.5) * (y - 0.5) - rx2 * ry2;
  while (2 * ry2 * x < 2 * rx2 * y) {
    addSymmetric(x, y);
    x++;
    if (p1 < 0) { p1 += 2 * ry2 * x + ry2; }
    else { y--; p1 += 2 * ry2 * x - 2 * rx2 * y + ry2; }
  }
  // Demi-grille : la dernière décrémentation de la zone 1 peut faire sortir y de la grille (-0.5)
  // en emportant le pixel (x, startY) ; on le rattrape. Sur grille entière, (rx, 0) est un point exact du bord.
  if (y < startY) y = startY;
  if (startY === 0) addSymmetric(rx, 0);
  let p2 = ry2 * (x + 0.5) * (x + 0.5) + rx2 * (y - 1) * (y - 1) - rx2 * ry2;
  while (y >= 0) {
    addSymmetric(x, y);
    y--;
    if (p2 > 0) { p2 -= 2 * rx2 * y + rx2; }
    else { x++; p2 += 2 * ry2 * x - 2 * rx2 * y + rx2; }
  }
  // Ellipses très plates : la zone 1 descend sur la rangée médiane avant d'atteindre rx et la zone 2
  // n'y ajoute qu'un pixel, d'où un trou avant l'extrémité. La rangée médiane est continue jusqu'au bord.
  for (let dx = minMidX; dx < rx; dx++) addSymmetric(dx, startY);
  return pts;
}

export function expandMirror(
  pts: Array<{ x: number; y: number }>,
  width: number,
  height: number,
  mirrorH: boolean,
  mirrorV: boolean,
): Array<{ x: number; y: number }> {
  if (!mirrorH && !mirrorV) return pts;
  const seen = new Set<string>(pts.map(p => `${p.x},${p.y}`));
  const result = [...pts];
  const add = (x: number, y: number) => {
    const k = `${x},${y}`;
    if (!seen.has(k)) { seen.add(k); result.push({ x, y }); }
  };
  for (const { x, y } of pts) {
    const mx = width - 1 - x;
    const my = height - 1 - y;
    if (mirrorH) add(mx, y);
    if (mirrorV) add(x, my);
    if (mirrorH && mirrorV) add(mx, my);
  }
  return result;
}

/** Symétrie centrale (rotation 180°) : chaque point ajoute son opposé par le centre du canvas. */
export function expandRotate180(
  pts: Array<{ x: number; y: number }>,
  width: number,
  height: number,
): Array<{ x: number; y: number }> {
  const seen = new Set<string>(pts.map(p => `${p.x},${p.y}`));
  const result = [...pts];
  const add = (x: number, y: number) => {
    const k = `${x},${y}`;
    if (!seen.has(k)) { seen.add(k); result.push({ x, y }); }
  };
  for (const { x, y } of pts) add(width - 1 - x, height - 1 - y);
  return result;
}

/** Type de symétrie actif ; un seul à la fois ('none' = désactivé). */
export type MirrorAxis = 'none' | 'horizontal' | 'vertical' | 'radial';

export interface SymmetryConfig {
  axis: MirrorAxis;
  /** « Par rotation » global : axe → symétrie centrale 180° ; radial → rotation pure (sinon kaléidoscope). */
  rotation: boolean;
  /** Nombre de segments radiaux (4 ou 8) ; utilisé seulement quand axis === 'radial'. */
  radialSegments: number;
}

export function expandRadial(
  pts: Array<{ x: number; y: number }>,
  width: number,
  height: number,
  segments: number,
  rotationOnly: boolean,
): Array<{ x: number; y: number }> {
  if (segments < 2) return pts;
  const cx = (width - 1) / 2;
  const cy = (height - 1) / 2;
  const seen = new Set<string>();
  const result: Array<{ x: number; y: number }> = [];
  const add = (x: number, y: number) => {
    const k = `${x},${y}`;
    if (!seen.has(k)) { seen.add(k); result.push({ x, y }); }
  };
  for (const { x, y } of pts) {
    const dx = x - cx;
    const dy = y - cy;
    // Kaléidoscope : on ajoute la version miroir avant rotation → groupe dièdral (2N copies).
    const bases: Array<[number, number]> = rotationOnly ? [[dx, dy]] : [[dx, dy], [dx, -dy]];
    for (const [bx, by] of bases) {
      for (let k = 0; k < segments; k++) {
        const a = (2 * Math.PI * k) / segments;
        const cos = Math.cos(a);
        const sin = Math.sin(a);
        add(Math.round(cx + bx * cos - by * sin), Math.round(cy + bx * sin + by * cos));
      }
    }
  }
  return result;
}

export function expandSymmetry(
  pts: Array<{ x: number; y: number }>,
  width: number,
  height: number,
  cfg: SymmetryConfig,
): Array<{ x: number; y: number }> {
  switch (cfg.axis) {
    case 'horizontal':
      return cfg.rotation ? expandRotate180(pts, width, height) : expandMirror(pts, width, height, true, false);
    case 'vertical':
      return cfg.rotation ? expandRotate180(pts, width, height) : expandMirror(pts, width, height, false, true);
    case 'radial':
      return expandRadial(pts, width, height, cfg.radialSegments, cfg.rotation);
    default:
      return pts;
  }
}

export function getShapePixels(
  tool: 'circle' | 'square' | 'line',
  start: { x: number; y: number },
  end: { x: number; y: number },
): Array<{ x: number; y: number }> {
  if (tool === 'line') return bresenham(start.x, start.y, end.x, end.y);
  if (tool === 'square') return getRectPixels(start.x, start.y, end.x, end.y);
  return getEllipsePixels(start.x, start.y, end.x, end.y);
}
