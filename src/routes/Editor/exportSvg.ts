import type { PixelLayer } from '@/types';

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace('#', '');
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
}

type FlatPixel = { r: number; g: number; b: number; a: number };

function getConnectedComponents(pixelSet: Set<string>): Set<string>[] {
  const remaining = new Set(pixelSet);
  const components: Set<string>[] = [];

  while (remaining.size > 0) {
    const start = remaining.values().next().value as string;
    const component = new Set<string>();
    const stack = [start];

    while (stack.length > 0) {
      const key = stack.pop()!;
      if (!remaining.has(key)) continue;
      remaining.delete(key);
      component.add(key);
      const [x, y] = key.split(',').map(Number) as [number, number];
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const nk = `${x + dx},${y + dy}`;
        if (remaining.has(nk)) stack.push(nk);
      }
    }

    components.push(component);
  }

  return components;
}

// For each connected component, emit directed boundary edges (CCW exterior, CW holes).
// Within a single connected component, each vertex has at most one outgoing edge,
// so the edgeMap is collision-free.
function traceComponentPath(component: Set<string>): string {
  const edgeMap = new Map<string, [number, number]>();

  for (const key of component) {
    const [x, y] = key.split(',').map(Number) as [number, number];
    if (!component.has(`${x},${y - 1}`))   edgeMap.set(`${x},${y}`,           [x + 1, y]);
    if (!component.has(`${x + 1},${y}`))   edgeMap.set(`${x + 1},${y}`,       [x + 1, y + 1]);
    if (!component.has(`${x},${y + 1}`))   edgeMap.set(`${x + 1},${y + 1}`,   [x,     y + 1]);
    if (!component.has(`${x - 1},${y}`))   edgeMap.set(`${x},${y + 1}`,       [x,     y]);
  }

  const visited = new Set<string>();
  const polygons: string[] = [];

  for (const startKey of edgeMap.keys()) {
    if (visited.has(startKey)) continue;

    const pts: [number, number][] = [];
    let key = startKey;

    while (!visited.has(key)) {
      visited.add(key);
      const [cx, cy] = key.split(',').map(Number) as [number, number];
      pts.push([cx, cy]);
      const next = edgeMap.get(key);
      if (!next) break;
      key = `${next[0]},${next[1]}`;
    }

    if (pts.length < 2) continue;

    // Drop collinear points
    const n = pts.length;
    const simplified = pts.filter((_, i) => {
      const prev = pts[(i - 1 + n) % n]!;
      const curr = pts[i]!;
      const next = pts[(i + 1) % n]!;
      const cross =
        (curr[0] - prev[0]) * (next[1] - prev[1]) -
        (curr[1] - prev[1]) * (next[0] - prev[0]);
      return cross !== 0;
    });

    polygons.push('M' + simplified.map(p => `${p[0]} ${p[1]}`).join('L') + 'Z');
  }

  return polygons.join('');
}

export function buildLayersSvg(layers: PixelLayer[], width: number, height: number): string {
  const flat: Record<string, FlatPixel> = {};

  for (const layer of layers) {
    if (!layer.visible) continue;
    for (const [key, color] of Object.entries(layer.pixels)) {
      const src = hexToRgb(color);
      const srcA = layer.opacity;
      const dst = flat[key] ?? { r: 0, g: 0, b: 0, a: 0 };
      const outA = srcA + dst.a * (1 - srcA);
      flat[key] = outA === 0
        ? { r: 0, g: 0, b: 0, a: 0 }
        : {
            r: (src.r * srcA + dst.r * dst.a * (1 - srcA)) / outA,
            g: (src.g * srcA + dst.g * dst.a * (1 - srcA)) / outA,
            b: (src.b * srcA + dst.b * dst.a * (1 - srcA)) / outA,
            a: outA,
          };
    }
  }

  const byColor = new Map<string, Set<string>>();
  for (const [key, c] of Object.entries(flat)) {
    if (c.a <= 0) continue;
    const hex = rgbToHex(c.r, c.g, c.b);
    const colorKey = c.a < 0.999 ? `${hex}|${c.a.toFixed(3)}` : hex;
    if (!byColor.has(colorKey)) byColor.set(colorKey, new Set());
    byColor.get(colorKey)!.add(key);
  }

  const elements: string[] = [];

  for (const [colorKey, pixelSet] of byColor) {
    const pipeIdx = colorKey.indexOf('|');
    const hex = pipeIdx === -1 ? colorKey : colorKey.slice(0, pipeIdx);
    const opacityAttr = pipeIdx === -1 ? '' : ` fill-opacity="${colorKey.slice(pipeIdx + 1)}"`;

    const d = getConnectedComponents(pixelSet)
      .map(traceComponentPath)
      .join('');

    if (d) {
      elements.push(`<path fill="${hex}"${opacityAttr} fill-rule="evenodd" d="${d}"/>`);
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" shape-rendering="crispEdges">${elements.join('')}</svg>`;
}
