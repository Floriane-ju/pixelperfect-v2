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
    const [x, y] = queue[head++];
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

export function getEllipsePixels(x0: number, y0: number, x1: number, y1: number): Array<{ x: number; y: number }> {
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  const rx = Math.abs(x1 - x0) / 2;
  const ry = Math.abs(y1 - y0) / 2;

  const seen = new Set<string>();
  const pts: Array<{ x: number; y: number }> = [];
  const add = (px: number, py: number) => {
    const k = `${px},${py}`;
    if (!seen.has(k)) { seen.add(k); pts.push({ x: px, y: py }); }
  };

  if (rx < 0.5 && ry < 0.5) { add(Math.round(cx), Math.round(cy)); return pts; }
  if (rx < 0.5) {
    for (let y = Math.round(cy - ry); y <= Math.round(cy + ry); y++) add(Math.round(cx), y);
    return pts;
  }
  if (ry < 0.5) {
    for (let x = Math.round(cx - rx); x <= Math.round(cx + rx); x++) add(x, Math.round(cy));
    return pts;
  }

  const rx2 = rx * rx, ry2 = ry * ry;
  let x = 0, y = ry;
  let p1 = ry2 - rx2 * ry + 0.25 * rx2;
  while (2 * ry2 * x < 2 * rx2 * y) {
    add(Math.round(cx + x), Math.round(cy + y));
    add(Math.round(cx - x), Math.round(cy + y));
    add(Math.round(cx + x), Math.round(cy - y));
    add(Math.round(cx - x), Math.round(cy - y));
    x++;
    if (p1 < 0) { p1 += 2 * ry2 * x + ry2; }
    else { y--; p1 += 2 * ry2 * x - 2 * rx2 * y + ry2; }
  }
  let p2 = ry2 * (x + 0.5) * (x + 0.5) + rx2 * (y - 1) * (y - 1) - rx2 * ry2;
  while (y >= 0) {
    add(Math.round(cx + x), Math.round(cy + y));
    add(Math.round(cx - x), Math.round(cy + y));
    add(Math.round(cx + x), Math.round(cy - y));
    add(Math.round(cx - x), Math.round(cy - y));
    y--;
    if (p2 > 0) { p2 -= 2 * rx2 * y + rx2; }
    else { x++; p2 += 2 * ry2 * x - 2 * rx2 * y + rx2; }
  }
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

export function getShapePixels(
  tool: 'circle' | 'square' | 'line',
  start: { x: number; y: number },
  end: { x: number; y: number },
): Array<{ x: number; y: number }> {
  if (tool === 'line') return bresenham(start.x, start.y, end.x, end.y);
  if (tool === 'square') return getRectPixels(start.x, start.y, end.x, end.y);
  return getEllipsePixels(start.x, start.y, end.x, end.y);
}
