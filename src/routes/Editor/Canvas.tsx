import { useCallback, useEffect, useRef, useState } from 'react';
import type { DrawingData, HexColor } from '@/types';
import { bresenham, expandMirror, floodFill, getShapePixels } from './shapePixels';
import styles from './Canvas.module.scss';

export type Tool = 'pencil' | 'eraser' | 'fill' | 'circle' | 'square' | 'line';

function isShapeTool(t: Tool): t is 'circle' | 'square' | 'line' {
  return t === 'circle' || t === 'square' || t === 'line';
}

interface CanvasProps {
  data: DrawingData;
  activeLayerId: string;
  tool: Tool;
  color: HexColor;
  mirrorH: boolean;
  mirrorV: boolean;
  onLayerChange: (layerId: string, pixels: Record<string, HexColor>) => void;
  onInvisibleLayerAttempt: () => void;
  onDrawStart?: () => void;
  onDrawEnd?: () => void;
}

interface Transform { x: number; y: number; scale: number; angle: number; }

const MIN_SCALE = 0.25;
const MAX_SCALE = 48;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export function Canvas({ data, activeLayerId, tool, color, mirrorH, mirrorV, onLayerChange, onInvisibleLayerAttempt, onDrawStart, onDrawEnd }: CanvasProps) {
  const checkerRef = useRef<HTMLCanvasElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewRef = useRef<HTMLCanvasElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const displaySizeRef = useRef({ w: 256, h: 256 });
  const [displaySize, setDisplaySize] = useState({ w: 256, h: 256 });

  const transformRef = useRef<Transform>({ x: 0, y: 0, scale: 1, angle: 0 });
  const [transform, setTransform] = useState<Transform>({ x: 0, y: 0, scale: 1, angle: 0 });

  const applyTransform = useCallback((t: Transform) => {
    transformRef.current = t;
    setTransform(t);
  }, []);

  const isDrawing = useRef(false);
  const lastPixel = useRef<{ x: number; y: number } | null>(null);
  const layerPixelsRef = useRef<Record<string, HexColor>>({});
  const drawSessionSnapshot = useRef<Record<string, HexColor> | null>(null);
  const shapeStartRef = useRef<{ x: number; y: number } | null>(null);

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

  const screenToCanvas = useCallback((sx: number, sy: number): { x: number; y: number } => {
    const wr = wrapperRef.current!.getBoundingClientRect();
    const { x: tx, y: ty, scale, angle } = transformRef.current;
    const rx = sx - (wr.left + wr.width / 2 + tx);
    const ry = sy - (wr.top + wr.height / 2 + ty);
    const rad = (angle * Math.PI) / 180;
    const usx = (rx * Math.cos(-rad) - ry * Math.sin(-rad)) / scale;
    const usy = (rx * Math.sin(-rad) + ry * Math.cos(-rad)) / scale;
    const ds = displaySizeRef.current;
    return {
      x: Math.floor((usx + ds.w / 2) * (data.width / ds.w)),
      y: Math.floor((usy + ds.h / 2) * (data.height / ds.h)),
    };
  }, [data.width, data.height]);

  const drawPreview = useCallback((pts: Array<{ x: number; y: number }>) => {
    const canvas = previewRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, data.width, data.height);
    ctx.fillStyle = color;
    for (const { x, y } of expandMirror(pts, data.width, data.height, mirrorH, mirrorV)) {
      if (x >= 0 && y >= 0 && x < data.width && y < data.height) ctx.fillRect(x, y, 1, 1);
    }
  }, [data.width, data.height, color, mirrorH, mirrorV]);

  const clearPreview = useCallback(() => {
    previewRef.current?.getContext('2d')?.clearRect(0, 0, data.width, data.height);
  }, [data.width, data.height]);

  const paint = useCallback((pixels: Array<{ x: number; y: number }>) => {
    const expanded = expandMirror(pixels, data.width, data.height, mirrorH, mirrorV);
    const next = { ...layerPixelsRef.current };
    let changed = false;
    for (const { x, y } of expanded) {
      if (x < 0 || y < 0 || x >= data.width || y >= data.height) continue;
      const key = `${x},${y}`;
      if (tool === 'pencil') { next[key] = color; changed = true; }
      else if (tool === 'eraser' && key in next) { delete next[key]; changed = true; }
    }
    if (!changed) return;
    layerPixelsRef.current = next;
    onLayerChange(activeLayerId, next);
  }, [tool, color, activeLayerId, data.width, data.height, onLayerChange, mirrorH, mirrorV]);

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    navPointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    wrapperRef.current?.setPointerCapture(e.pointerId);

    // 2+ fingers → navigation (cancel any in-progress drawing and rollback pixels)
    if (navPointers.current.size >= 2) {
      if (isDrawing.current && drawSessionSnapshot.current !== null) {
        layerPixelsRef.current = drawSessionSnapshot.current;
        onLayerChange(activeLayerId, drawSessionSnapshot.current);
      }
      clearPreview();
      shapeStartRef.current = null;
      isDrawing.current = false;
      lastPixel.current = null;
      drawSessionSnapshot.current = null;
      panLastPos.current = null;
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

    if (e.button !== 0) return;

    // Single touch/click on empty area (outside canvas) → pan
    if (e.target !== canvasRef.current) {
      panLastPos.current = { x: e.clientX, y: e.clientY };
      return;
    }

    // Single left click on canvas → draw
    const activeLayer = data.layers.find(l => l.id === activeLayerId);
    if (activeLayer && !activeLayer.visible) {
      onInvisibleLayerAttempt();
      navPointers.current.delete(e.pointerId);
      wrapperRef.current?.releasePointerCapture(e.pointerId);
      return;
    }
    const px = screenToCanvas(e.clientX, e.clientY);

    if (tool === 'fill') {
      onDrawStart?.();
      const filled = floodFill(layerPixelsRef.current, px.x, px.y, data.width, data.height, color);
      if (filled) {
        layerPixelsRef.current = filled;
        onLayerChange(activeLayerId, filled);
      }
      onDrawEnd?.();
      return;
    }

    if (isShapeTool(tool)) {
      onDrawStart?.();
      drawSessionSnapshot.current = { ...layerPixelsRef.current };
      isDrawing.current = true;
      shapeStartRef.current = px;
      drawPreview([px]);
      return;
    }

    onDrawStart?.();
    drawSessionSnapshot.current = { ...layerPixelsRef.current };
    isDrawing.current = true;
    lastPixel.current = px;
    paint([px]);
  }, [data.layers, data.width, data.height, activeLayerId, tool, color, onInvisibleLayerAttempt, screenToCanvas, paint, onLayerChange, drawPreview, clearPreview, onDrawStart, onDrawEnd]);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
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
        const wr = wrapperRef.current!.getBoundingClientRect();
        const wcx = wr.left + wr.width / 2;
        const wcy = wr.top + wr.height / 2;
        const smx = (sp0.x + sp1.x) / 2, smy = (sp0.y + sp1.y) / 2;
        const cmx = (cp0.x + cp1.x) / 2, cmy = (cp0.y + cp1.y) / 2;
        const sdist = Math.hypot(sp1.x - sp0.x, sp1.y - sp0.y);
        const cdist = Math.hypot(cp1.x - cp0.x, cp1.y - cp0.y);
        const angleDelta = (
          Math.atan2(cp1.y - cp0.y, cp1.x - cp0.x) -
          Math.atan2(sp1.y - sp0.y, sp1.x - sp0.x)
        ) * (180 / Math.PI);
        const newScale = clamp(snap.transform.scale * (sdist > 0 ? cdist / sdist : 1), MIN_SCALE, MAX_SCALE);
        const pivotX = smx - wcx - snap.transform.x;
        const pivotY = smy - wcy - snap.transform.y;
        const rad = angleDelta * Math.PI / 180;
        const rotPivotX = pivotX * Math.cos(rad) - pivotY * Math.sin(rad);
        const rotPivotY = pivotX * Math.sin(rad) + pivotY * Math.cos(rad);
        applyTransform({
          x: cmx - wcx - rotPivotX * newScale / snap.transform.scale,
          y: cmy - wcy - rotPivotY * newScale / snap.transform.scale,
          scale: newScale,
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

    if (!isDrawing.current) return;
    const px = screenToCanvas(e.clientX, e.clientY);

    if (isShapeTool(tool) && shapeStartRef.current) {
      drawPreview(getShapePixels(tool, shapeStartRef.current, px));
      return;
    }

    const last = lastPixel.current;
    paint(last ? bresenham(last.x, last.y, px.x, px.y) : [px]);
    lastPixel.current = px;
  }, [applyTransform, screenToCanvas, paint, tool, drawPreview]);

  const handlePointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    wrapperRef.current?.releasePointerCapture(e.pointerId);
    navPointers.current.delete(e.pointerId);
    const remaining = navPointers.current.size;
    if (remaining < 2) {
      const wasNav = navSnapshot.current !== null;
      navSnapshot.current = null;
      if (remaining === 1 && wasNav) {
        const [pos] = navPointers.current.values();
        panLastPos.current = pos ?? null;
      }
    }
    if (remaining === 0) panLastPos.current = null;

    const wasDrawing = isDrawing.current;

    if (wasDrawing && isShapeTool(tool) && shapeStartRef.current) {
      const endPx = screenToCanvas(e.clientX, e.clientY);
      const pts = expandMirror(getShapePixels(tool, shapeStartRef.current, endPx), data.width, data.height, mirrorH, mirrorV);
      const next = { ...layerPixelsRef.current };
      for (const { x, y } of pts) {
        if (x >= 0 && y >= 0 && x < data.width && y < data.height) next[`${x},${y}`] = color;
      }
      layerPixelsRef.current = next;
      onLayerChange(activeLayerId, next);
      clearPreview();
      shapeStartRef.current = null;
      onDrawEnd?.();
    } else if (wasDrawing) {
      onDrawEnd?.();
    }

    isDrawing.current = false;
    lastPixel.current = null;
    drawSessionSnapshot.current = null;
  }, [tool, screenToCanvas, data.width, data.height, color, activeLayerId, onLayerChange, clearPreview, mirrorH, mirrorV, onDrawEnd]);

  const cssSize = { width: displaySize.w, height: displaySize.h };
  const { x, y, scale, angle } = transform;

  return (
    <div
      ref={wrapperRef}
      className={styles.wrapper}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      <div
        className={styles.stack}
        style={{ ...cssSize, transform: `translate(${x}px,${y}px) rotate(${angle}deg) scale(${scale})` }}
      >
        <canvas ref={checkerRef} className={styles.checker} width={data.width} height={data.height} />
        <canvas ref={canvasRef} className={styles.canvas} width={data.width} height={data.height} />
        <canvas ref={previewRef} className={styles.preview} width={data.width} height={data.height} />
      </div>
    </div>
  );
}
