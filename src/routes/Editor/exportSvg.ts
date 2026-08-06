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

type Point = [number, number];

// For each connected component, emit directed boundary edges (each pixel contributes
// its uncovered sides, oriented so the filled side stays on the same hand).
// A vertex can carry TWO outgoing edges when two diagonally-touching pixels of the
// same component meet there ("saddle" corner), so edges are stored as a list and the
// traversal is keyed by directed edge, not by vertex.
function traceComponentPath(component: Set<string>): string {
  const outgoing = new Map<string, Point[]>();
  const addEdge = (from: Point, to: Point): void => {
    const key = `${from[0]},${from[1]}`;
    const list = outgoing.get(key);
    if (list) list.push(to);
    else outgoing.set(key, [to]);
  };

  for (const key of component) {
    const [x, y] = key.split(',').map(Number) as Point;
    if (!component.has(`${x},${y - 1}`))   addEdge([x,     y],     [x + 1, y]);
    if (!component.has(`${x + 1},${y}`))   addEdge([x + 1, y],     [x + 1, y + 1]);
    if (!component.has(`${x},${y + 1}`))   addEdge([x + 1, y + 1], [x,     y + 1]);
    if (!component.has(`${x - 1},${y}`))   addEdge([x,     y + 1], [x,     y]);
  }

  const visited = new Set<string>();
  const polygons: string[] = [];

  for (const [fromKey, targets] of outgoing) {
    for (const firstTarget of targets) {
      if (visited.has(`${fromKey}>${firstTarget[0]},${firstTarget[1]}`)) continue;

      const pts: Point[] = [];
      let from = fromKey.split(',').map(Number) as Point;
      let to = firstTarget;

      for (;;) {
        const edgeKey = `${from[0]},${from[1]}>${to[0]},${to[1]}`;
        if (visited.has(edgeKey)) break;
        visited.add(edgeKey);
        pts.push(from);

        const candidates = outgoing.get(`${to[0]},${to[1]}`);
        if (!candidates || candidates.length === 0) break;

        let next = candidates[0]!;
        if (candidates.length > 1) {
          // Saddle corner: always take the same turn so the two boundaries pass
          // each other instead of crossing, which would break the fill.
          const dx = to[0] - from[0];
          const dy = to[1] - from[1];
          next =
            candidates.find(
              c => dx * (c[1] - to[1]) - dy * (c[0] - to[0]) > 0,
            ) ?? next;
        }

        from = to;
        to = next;
      }

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

      if (simplified.length < 3) continue;

      polygons.push('M' + simplified.map(p => `${p[0]} ${p[1]}`).join('L') + 'Z');
    }
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
