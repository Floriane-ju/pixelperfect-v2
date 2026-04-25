import { useCallback, useEffect, useRef, useState } from 'react';
import type { DrawingData, HexColor } from '@/types';
import styles from './Canvas.module.scss';

type Tool = 'pencil' | 'eraser' | 'fill';

interface CanvasProps {
  data: DrawingData;
  activeLayerId: string;
  tool: Tool;
  color: HexColor;
  onLayerChange: (layerId: string, pixels: Record<string, HexColor>) => void;
  onInvisibleLayerAttempt: () => void;
}

interface Transform { x: number; y: number; scale: number; angle: number; }

const MIN_SCALE = 0.25;
const MAX_SCALE = 48;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

function floodFill(
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

function bresenham(x0: number, y0: number, x1: number, y1: number): Array<{ x: number; y: number }> {
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

export function Canvas({ data, activeLayerId, tool, color, onLayerChange, onInvisibleLayerAttempt }: CanvasProps) {
  const checkerRef = useRef<HTMLCanvasElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Display size: logical CSS dimensions of the canvas before any transform
  const displaySizeRef = useRef({ w: 256, h: 256 });
  const [displaySize, setDisplaySize] = useState({ w: 256, h: 256 });

  // View transform: applied to the .stack div
  const transformRef = useRef<Transform>({ x: 0, y: 0, scale: 1, angle: 0 });
  const [transform, setTransform] = useState<Transform>({ x: 0, y: 0, scale: 1, angle: 0 });

  const applyTransform = useCallback((t: Transform) => {
    transformRef.current = t;
    setTransform(t);
  }, []);

  // Drawing state
  const isDrawing = useRef(false);
  const lastPixel = useRef<{ x: number; y: number } | null>(null);
  const layerPixelsRef = useRef<Record<string, HexColor>>({});
  const drawSessionSnapshot = useRef<Record<string, HexColor> | null>(null);

  // Navigation state
  const navPointers = useRef(new Map<number, { x: number; y: number }>());
  const navSnapshot = useRef<{
    pointers: Map<number, { x: number; y: number }>;
    transform: Transform;
  } | null>(null);
  const panLastPos = useRef<{ x: number; y: number } | null>(null);

  // Checkerboard (redrawn only when dimensions change)
  useEffect(() => {
    const canvas = checkerRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    for (let y = 0; y < data.height; y++) {
      for (let x = 0; x < data.width; x++) {
        ctx.fillStyle = (x + y) % 2 === 0 ? '#747474' : '#979797';
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }, [data.width, data.height]);

  // Sync active layer pixels into ref to avoid stale closures
  useEffect(() => {
    const layer = data.layers.find(l => l.id === activeLayerId);
    layerPixelsRef.current = layer ? { ...layer.pixels } : {};
  }, [data, activeLayerId]);

  // Composite render
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, data.width, data.height);
    for (const layer of data.layers) {
      if (!layer.visible) continue;
      ctx.globalAlpha = layer.opacity;
      for (const [key, c] of Object.entries(layer.pixels)) {
        const comma = key.indexOf(',');
        ctx.fillStyle = c;
        ctx.fillRect(parseInt(key.slice(0, comma), 10), parseInt(key.slice(comma + 1), 10), 1, 1);
      }
    }
    ctx.globalAlpha = 1;
  }, [data]);

  // Responsive display size
  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const observer = new ResizeObserver(entries => {
      const { width, height } = entries[0]!.contentRect;
      const s = Math.min((width * 0.9) / data.width, (height * 0.9) / data.height);
      const ds = { w: Math.floor(data.width * s), h: Math.floor(data.height * s) };
      displaySizeRef.current = ds;
      setDisplaySize(ds);
    });
    observer.observe(wrapper);
    return () => observer.disconnect();
  }, [data.width, data.height]);

  // Wheel: zoom toward cursor (mouse wheel) or trackpad pinch (ctrlKey)
  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const wr = wrapper.getBoundingClientRect();
      const wcx = wr.left + wr.width / 2;
      const wcy = wr.top + wr.height / 2;
      const t = transformRef.current;
      // ctrlKey = true for trackpad pinch (continuous), false for mouse wheel (discrete)
      const delta = e.ctrlKey ? e.deltaY / 100 : Math.sign(e.deltaY) * 0.15;
      const factor = Math.exp(-delta);
      const newScale = clamp(t.scale * factor, MIN_SCALE, MAX_SCALE);
      const ratio = newScale / t.scale;
      const cx = e.clientX - wcx;
      const cy = e.clientY - wcy;
      applyTransform({ ...t, scale: newScale, x: cx + (t.x - cx) * ratio, y: cy + (t.y - cy) * ratio });
    };
    wrapper.addEventListener('wheel', onWheel, { passive: false });
    return () => wrapper.removeEventListener('wheel', onWheel);
  }, [applyTransform]);

  // Convert screen coordinates to drawing pixel coordinates (inverse of CSS transform)
  const screenToCanvas = useCallback((sx: number, sy: number): { x: number; y: number } => {
    const wr = wrapperRef.current!.getBoundingClientRect();
    const { x: tx, y: ty, scale, angle } = transformRef.current;
    // Point relative to transform origin (wrapper center + pan offset)
    const rx = sx - (wr.left + wr.width / 2 + tx);
    const ry = sy - (wr.top + wr.height / 2 + ty);
    // Inverse rotate
    const rad = (angle * Math.PI) / 180;
    const usx = (rx * Math.cos(-rad) - ry * Math.sin(-rad)) / scale;
    const usy = (rx * Math.sin(-rad) + ry * Math.cos(-rad)) / scale;
    // Map from center-relative to top-left-relative, then to drawing pixels
    const ds = displaySizeRef.current;
    return {
      x: Math.floor((usx + ds.w / 2) * (data.width / ds.w)),
      y: Math.floor((usy + ds.h / 2) * (data.height / ds.h)),
    };
  }, [data.width, data.height]);

  const paint = useCallback((pixels: Array<{ x: number; y: number }>) => {
    const next = { ...layerPixelsRef.current };
    let changed = false;
    for (const { x, y } of pixels) {
      if (x < 0 || y < 0 || x >= data.width || y >= data.height) continue;
      const key = `${x},${y}`;
      if (tool === 'pencil') { next[key] = color; changed = true; }
      else if (tool === 'eraser' && key in next) { delete next[key]; changed = true; }
    }
    if (!changed) return;
    layerPixelsRef.current = next;
    onLayerChange(activeLayerId, next);
  }, [tool, color, activeLayerId, data.width, data.height, onLayerChange]);

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    navPointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    canvasRef.current?.setPointerCapture(e.pointerId);

    // 2+ fingers → navigation (cancel any in-progress drawing and rollback pixels)
    if (navPointers.current.size >= 2) {
      if (isDrawing.current && drawSessionSnapshot.current !== null) {
        layerPixelsRef.current = drawSessionSnapshot.current;
        onLayerChange(activeLayerId, drawSessionSnapshot.current);
      }
      isDrawing.current = false;
      lastPixel.current = null;
      drawSessionSnapshot.current = null;
      navSnapshot.current = {
        pointers: new Map(navPointers.current),
        transform: { ...transformRef.current },
      };
      return;
    }

    // Middle mouse button → pan
    if (e.button === 1) {
      panLastPos.current = { x: e.clientX, y: e.clientY };
      return;
    }

    // Single left click / single touch → draw
    if (e.button !== 0) return;
    const activeLayer = data.layers.find(l => l.id === activeLayerId);
    if (activeLayer && !activeLayer.visible) {
      onInvisibleLayerAttempt();
      navPointers.current.delete(e.pointerId);
      canvasRef.current?.releasePointerCapture(e.pointerId);
      return;
    }
    const px = screenToCanvas(e.clientX, e.clientY);

    if (tool === 'fill') {
      const filled = floodFill(layerPixelsRef.current, px.x, px.y, data.width, data.height, color);
      if (filled) {
        layerPixelsRef.current = filled;
        onLayerChange(activeLayerId, filled);
      }
      return;
    }

    drawSessionSnapshot.current = { ...layerPixelsRef.current };
    isDrawing.current = true;
    lastPixel.current = px;
    paint([px]);
  }, [data.layers, data.width, data.height, activeLayerId, tool, color, onInvisibleLayerAttempt, screenToCanvas, paint, onLayerChange]);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    navPointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    // 2-finger gesture: pan + zoom + rotate
    if (navPointers.current.size >= 2 && navSnapshot.current) {
      const snap = navSnapshot.current;
      const ids = Array.from(snap.pointers.keys());
      const sp0 = snap.pointers.get(ids[0])!;
      const sp1 = snap.pointers.get(ids[1])!;
      const cp0 = navPointers.current.get(ids[0]);
      const cp1 = navPointers.current.get(ids[1]);
      if (cp0 && cp1) {
        const smx = (sp0.x + sp1.x) / 2, smy = (sp0.y + sp1.y) / 2;
        const cmx = (cp0.x + cp1.x) / 2, cmy = (cp0.y + cp1.y) / 2;
        const sdist = Math.hypot(sp1.x - sp0.x, sp1.y - sp0.y);
        const cdist = Math.hypot(cp1.x - cp0.x, cp1.y - cp0.y);
        const angleDelta = (
          Math.atan2(cp1.y - cp0.y, cp1.x - cp0.x) -
          Math.atan2(sp1.y - sp0.y, sp1.x - sp0.x)
        ) * (180 / Math.PI);
        applyTransform({
          x: snap.transform.x + (cmx - smx),
          y: snap.transform.y + (cmy - smy),
          scale: clamp(snap.transform.scale * (sdist > 0 ? cdist / sdist : 1), MIN_SCALE, MAX_SCALE),
          angle: snap.transform.angle + angleDelta,
        });
      }
      return;
    }

    // Middle mouse pan
    if (panLastPos.current) {
      const t = transformRef.current;
      applyTransform({ ...t, x: t.x + e.clientX - panLastPos.current.x, y: t.y + e.clientY - panLastPos.current.y });
      panLastPos.current = { x: e.clientX, y: e.clientY };
      return;
    }

    // Draw
    if (!isDrawing.current) return;
    const px = screenToCanvas(e.clientX, e.clientY);
    const last = lastPixel.current;
    paint(last ? bresenham(last.x, last.y, px.x, px.y) : [px]);
    lastPixel.current = px;
  }, [applyTransform, screenToCanvas, paint]);

  const handlePointerUp = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    canvasRef.current?.releasePointerCapture(e.pointerId);
    navPointers.current.delete(e.pointerId);
    if (navPointers.current.size < 2) navSnapshot.current = null;
    if (navPointers.current.size === 0) panLastPos.current = null;
    isDrawing.current = false;
    lastPixel.current = null;
    drawSessionSnapshot.current = null;
  }, []);

  const cssSize = { width: displaySize.w, height: displaySize.h };
  const { x, y, scale, angle } = transform;

  return (
    <div ref={wrapperRef} className={styles.wrapper}>
      <div
        className={styles.stack}
        style={{ ...cssSize, transform: `translate(${x}px,${y}px) rotate(${angle}deg) scale(${scale})` }}
      >
        <canvas ref={checkerRef} className={styles.checker} width={data.width} height={data.height} />
        <canvas
          ref={canvasRef}
          className={styles.canvas}
          width={data.width}
          height={data.height}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        />
      </div>
    </div>
  );
}
