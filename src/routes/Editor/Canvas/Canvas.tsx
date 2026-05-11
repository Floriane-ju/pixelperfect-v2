import { useCallback, useEffect, useRef, useState } from 'react';
import type { DrawingData, HexColor } from '@/types';
import { bresenham, expandMirror, floodFill, getShapePixels } from '@/routes/Editor/shapePixels';
import { isShapeTool, applyShape } from './shapes';
import type { Tool } from './shapes';
import { useCanvasNavigation } from './useCanvasNavigation';
import styles from './Canvas.module.scss';

export type { Tool };

const PIPETTE_HOLD_MS = 500;
const PIPETTE_INDICATOR_DELAY_MS = 200;

interface RefImageState {
  src: string;
  x: number;
  y: number;
  scale: number;
  opacity: number;
  naturalWidth: number;
  naturalHeight: number;
}

interface CanvasProps {
  data: DrawingData;
  activeLayerId: string;
  tool: Tool;
  color: HexColor;
  brushSize?: number;
  mirrorH: boolean;
  mirrorV: boolean;
  onLayerChange: (layerId: string, pixels: Record<string, HexColor>) => void;
  onInvisibleLayerAttempt: () => void;
  onDrawStart?: () => void;
  onDrawEnd?: () => void;
  onPickColor?: (color: HexColor) => void;
  hoveredColor?: HexColor | null;
  refImage?: RefImageState | null;
  onDisplaySizeChange?: (size: { w: number; h: number }) => void;
}

function stampBrush(pixels: Array<{ x: number; y: number }>, size: number): Array<{ x: number; y: number }> {
  if (size <= 1) return pixels;
  const offset = Math.floor((size - 1) / 2);
  const out: Array<{ x: number; y: number }> = [];
  for (const { x, y } of pixels) {
    for (let dy = 0; dy < size; dy++) {
      for (let dx = 0; dx < size; dx++) {
        out.push({ x: x + dx - offset, y: y + dy - offset });
      }
    }
  }
  return out;
}

export function Canvas({ data, activeLayerId, tool, color, brushSize = 1, mirrorH, mirrorV, onLayerChange, onInvisibleLayerAttempt, onDrawStart, onDrawEnd, onPickColor, hoveredColor, refImage, onDisplaySizeChange }: CanvasProps) {
  const checkerRef = useRef<HTMLCanvasElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewRef = useRef<HTMLCanvasElement>(null);
  const highlightRef = useRef<HTMLCanvasElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const displaySizeRef = useRef({ w: 256, h: 256 });
  const [displaySize, setDisplaySize] = useState({ w: 256, h: 256 });
  const [pickerIndicator, setPickerIndicator] = useState<{ x: number; y: number } | null>(null);

  const { transform, transformRef, onNavPointerDown, onNavPointerMove, onNavPointerUp } = useCanvasNavigation(wrapperRef);

  const isDrawing = useRef(false);
  const lastPixel = useRef<{ x: number; y: number } | null>(null);
  const layerPixelsRef = useRef<Record<string, HexColor>>({});
  const drawSessionSnapshot = useRef<Record<string, HexColor> | null>(null);
  const shapeStartRef = useRef<{ x: number; y: number } | null>(null);
  const longPressTimerRef = useRef<number | null>(null);
  const longPressFiredRef = useRef(false);
  const pressOriginRef = useRef<{ sx: number; sy: number } | null>(null);
  const indicatorTimerRef = useRef<number | null>(null);
  const pendingStartRef = useRef<{ x: number; y: number } | null>(null);

  const clearLongPress = useCallback(() => {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    if (indicatorTimerRef.current !== null) {
      window.clearTimeout(indicatorTimerRef.current);
      indicatorTimerRef.current = null;
    }
    pressOriginRef.current = null;
    setPickerIndicator(null);
  }, []);

  const pickColorAt = useCallback((px: { x: number; y: number }) => {
    if (px.x < 0 || px.y < 0 || px.x >= data.width || px.y >= data.height) return;
    const key = `${px.x},${px.y}`;
    for (let i = data.layers.length - 1; i >= 0; i--) {
      const layer = data.layers[i];
      if (!layer || !layer.visible) continue;
      const picked = layer.pixels[key];
      if (picked) {
        onPickColor?.(picked);
        return;
      }
    }
  }, [data.layers, data.width, data.height, onPickColor]);

  // Per-layer offscreen cache. Each layer's pixel map is rasterised once into its own canvas.
  // Composite step just stacks the cached canvases. Strokes mutate the active layer's offscreen incrementally.
  const layerCanvasesRef = useRef<Map<string, { canvas: HTMLCanvasElement; pixelsRef: Record<string, HexColor> }>>(new Map());

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

  const recompositeMain = useCallback(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, data.width, data.height);
    for (const layer of data.layers) {
      if (!layer.visible) continue;
      const entry = layerCanvasesRef.current.get(layer.id);
      if (!entry) continue;
      ctx.globalAlpha = layer.opacity;
      ctx.drawImage(entry.canvas, 0, 0);
    }
    ctx.globalAlpha = 1;
  }, [data]);

  // Sync per-layer offscreen cache and composite main canvas.
  // Each layer is rasterised only when its pixels reference changes.
  useEffect(() => {
    const cache = layerCanvasesRef.current;
    const seen = new Set<string>();
    for (const layer of data.layers) {
      seen.add(layer.id);
      let entry = cache.get(layer.id);
      const needsResize = entry && (entry.canvas.width !== data.width || entry.canvas.height !== data.height);
      if (entry && entry.pixelsRef === layer.pixels && !needsResize) continue;
      if (!entry) {
        const c = document.createElement('canvas');
        c.width = data.width;
        c.height = data.height;
        entry = { canvas: c, pixelsRef: layer.pixels };
        cache.set(layer.id, entry);
      } else if (needsResize) {
        entry.canvas.width = data.width;
        entry.canvas.height = data.height;
      }
      const ctx = entry.canvas.getContext('2d');
      if (!ctx) continue;
      ctx.clearRect(0, 0, data.width, data.height);
      for (const [key, c] of Object.entries(layer.pixels)) {
        const comma = key.indexOf(',');
        ctx.fillStyle = c;
        ctx.fillRect(parseInt(key.slice(0, comma), 10), parseInt(key.slice(comma + 1), 10), 1, 1);
      }
      entry.pixelsRef = layer.pixels;
    }
    for (const id of Array.from(cache.keys())) {
      if (!seen.has(id)) cache.delete(id);
    }
    recompositeMain();
  }, [data, recompositeMain]);

  // Highlight pixels matching hoveredColor (circle 40% of pixel size)
  useEffect(() => {
    const canvas = highlightRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!hoveredColor) return;
    const pxSize = displaySize.w / data.width;
    const radius = pxSize * 0.1;
    const r = parseInt(hoveredColor.slice(1, 3), 16) / 255;
    const g = parseInt(hoveredColor.slice(3, 5), 16) / 255;
    const b = parseInt(hoveredColor.slice(5, 7), 16) / 255;
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    ctx.fillStyle = lum > 0.5 ? 'rgba(0,0,0,0.9)' : 'rgba(255,255,255,0.9)';
    for (const layer of data.layers) {
      if (!layer.visible) continue;
      for (const [key, c] of Object.entries(layer.pixels)) {
        if (c !== hoveredColor) continue;
        const comma = key.indexOf(',');
        const px = parseInt(key.slice(0, comma), 10);
        const py = parseInt(key.slice(comma + 1), 10);
        ctx.beginPath();
        ctx.arc((px + 0.5) * pxSize, (py + 0.5) * pxSize, radius, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }, [hoveredColor, data, displaySize]);

  // Responsive display size
  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const observer = new ResizeObserver(entries => {
      const rect = entries[0]?.contentRect;
      if (!rect) return;
      const s = Math.min((rect.width * 0.9) / data.width, (rect.height * 0.9) / data.height);
      const ds = { w: Math.floor(data.width * s), h: Math.floor(data.height * s) };
      displaySizeRef.current = ds;
      setDisplaySize(ds);
      onDisplaySizeChange?.(ds);
    });
    observer.observe(wrapper);
    return () => observer.disconnect();
  }, [data.width, data.height, onDisplaySizeChange]);

  const screenToCanvas = useCallback((sx: number, sy: number): { x: number; y: number } => {
    const wr = wrapperRef.current?.getBoundingClientRect();
    if (!wr) return { x: 0, y: 0 };
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
  }, [data.width, data.height, transformRef]);

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
    const stamped = stampBrush(pixels, brushSize);
    const expanded = expandMirror(stamped, data.width, data.height, mirrorH, mirrorV);
    const active = layerCanvasesRef.current.get(activeLayerId);
    const lctx = active?.canvas.getContext('2d') ?? null;
    const map = layerPixelsRef.current;
    let changed = false;
    for (const { x, y } of expanded) {
      if (x < 0 || y < 0 || x >= data.width || y >= data.height) continue;
      const key = `${x},${y}`;
      if (tool === 'pencil') {
        map[key] = color;
        if (lctx) { lctx.fillStyle = color; lctx.fillRect(x, y, 1, 1); }
        changed = true;
      } else if (tool === 'eraser' && key in map) {
        delete map[key];
        if (lctx) lctx.clearRect(x, y, 1, 1);
        changed = true;
      }
    }
    if (!changed) return;
    recompositeMain();
  }, [tool, color, brushSize, activeLayerId, data.width, data.height, mirrorH, mirrorV, recompositeMain]);

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    wrapperRef.current?.setPointerCapture(e.pointerId);
    const navResult = onNavPointerDown(e.pointerId, e.clientX, e.clientY, e.button, e.target === canvasRef.current);

    if (navResult === 'cancel') {
      clearLongPress();
      if (isDrawing.current && drawSessionSnapshot.current !== null) {
        layerPixelsRef.current = drawSessionSnapshot.current;
        const active = layerCanvasesRef.current.get(activeLayerId);
        if (active) {
          active.pixelsRef = layerPixelsRef.current;
          const ctx = active.canvas.getContext('2d');
          if (ctx) {
            ctx.clearRect(0, 0, data.width, data.height);
            for (const [key, c] of Object.entries(drawSessionSnapshot.current)) {
              const comma = key.indexOf(',');
              ctx.fillStyle = c;
              ctx.fillRect(parseInt(key.slice(0, comma), 10), parseInt(key.slice(comma + 1), 10), 1, 1);
            }
          }
        }
        recompositeMain();
      }
      clearPreview();
      shapeStartRef.current = null;
      isDrawing.current = false;
      lastPixel.current = null;
      drawSessionSnapshot.current = null;
      pendingStartRef.current = null;
      return;
    }

    if (navResult !== 'draw') return;

    const px = screenToCanvas(e.clientX, e.clientY);

    if (tool === 'eyedropper') {
      pickColorAt(px);
      return;
    }

    const activeLayer = data.layers.find(l => l.id === activeLayerId);
    if (activeLayer && !activeLayer.visible) {
      onInvisibleLayerAttempt();
      onNavPointerUp(e.pointerId);
      wrapperRef.current?.releasePointerCapture(e.pointerId);
      return;
    }

    if (tool === 'fill') {
      onDrawStart?.();
      const filled = floodFill(layerPixelsRef.current, px.x, px.y, data.width, data.height, color);
      if (filled) { layerPixelsRef.current = filled; onLayerChange(activeLayerId, filled); }
      onDrawEnd?.();
      return;
    }

    const scheduleLongPress = () => {
      longPressFiredRef.current = false;
      pressOriginRef.current = { sx: e.clientX, sy: e.clientY };
      const sx = e.clientX;
      const sy = e.clientY;
      indicatorTimerRef.current = window.setTimeout(() => {
        const wr = wrapperRef.current?.getBoundingClientRect();
        if (wr) setPickerIndicator({ x: sx - wr.left, y: sy - wr.top });
        indicatorTimerRef.current = null;
      }, PIPETTE_INDICATOR_DELAY_MS);
      longPressTimerRef.current = window.setTimeout(() => {
        const snapshot = drawSessionSnapshot.current;
        if (snapshot !== null) {
          layerPixelsRef.current = snapshot;
          const active = layerCanvasesRef.current.get(activeLayerId);
          if (active) {
            active.pixelsRef = layerPixelsRef.current;
            const ctx = active.canvas.getContext('2d');
            if (ctx) {
              ctx.clearRect(0, 0, data.width, data.height);
              for (const [key, c] of Object.entries(snapshot)) {
                const comma = key.indexOf(',');
                ctx.fillStyle = c;
                ctx.fillRect(parseInt(key.slice(0, comma), 10), parseInt(key.slice(comma + 1), 10), 1, 1);
              }
            }
          }
          recompositeMain();
        }
        clearPreview();
        pickColorAt(px);
        isDrawing.current = false;
        lastPixel.current = null;
        drawSessionSnapshot.current = null;
        shapeStartRef.current = null;
        longPressFiredRef.current = true;
        longPressTimerRef.current = null;
        pressOriginRef.current = null;
        setPickerIndicator(null);
      }, PIPETTE_HOLD_MS);
    };

    if (isShapeTool(tool)) {
      onDrawStart?.();
      drawSessionSnapshot.current = { ...layerPixelsRef.current };
      isDrawing.current = true;
      shapeStartRef.current = px;
      drawPreview([px]);
      scheduleLongPress();
      return;
    }

    onDrawStart?.();
    drawSessionSnapshot.current = { ...layerPixelsRef.current };
    // Bind cache to mutable ref so the post-commit sync identity check (pixelsRef === layer.pixels) is true and skips redraw.
    const activeEntry = layerCanvasesRef.current.get(activeLayerId);
    if (activeEntry) activeEntry.pixelsRef = layerPixelsRef.current;
    isDrawing.current = true;
    lastPixel.current = px;
    pendingStartRef.current = px;
    scheduleLongPress();
  }, [data.layers, data.width, data.height, activeLayerId, tool, color, onInvisibleLayerAttempt, pickColorAt, screenToCanvas, onLayerChange, drawPreview, clearPreview, onDrawStart, onDrawEnd, onNavPointerDown, onNavPointerUp, recompositeMain, clearLongPress]);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (onNavPointerMove(e.pointerId, e.clientX, e.clientY)) return;
    if (!isDrawing.current) return;
    const origin = pressOriginRef.current;
    if (origin) {
      const dx = e.clientX - origin.sx;
      const dy = e.clientY - origin.sy;
      if (dx * dx + dy * dy > 36) clearLongPress();
    }
    const px = screenToCanvas(e.clientX, e.clientY);
    if (isShapeTool(tool) && shapeStartRef.current) {
      drawPreview(getShapePixels(tool, shapeStartRef.current, px));
      return;
    }
    const pending = pendingStartRef.current;
    const last = lastPixel.current;
    if (pending) {
      paint(bresenham(pending.x, pending.y, px.x, px.y));
      pendingStartRef.current = null;
    } else {
      paint(last ? bresenham(last.x, last.y, px.x, px.y) : [px]);
    }
    lastPixel.current = px;
  }, [onNavPointerMove, screenToCanvas, paint, tool, drawPreview, clearLongPress]);

  const handlePointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    wrapperRef.current?.releasePointerCapture(e.pointerId);
    onNavPointerUp(e.pointerId);
    clearLongPress();

    if (longPressFiredRef.current) {
      longPressFiredRef.current = false;
      isDrawing.current = false;
      lastPixel.current = null;
      drawSessionSnapshot.current = null;
      pendingStartRef.current = null;
      return;
    }

    const wasDrawing = isDrawing.current;

    if (wasDrawing && isShapeTool(tool) && shapeStartRef.current) {
      const endPx = screenToCanvas(e.clientX, e.clientY);
      const next = applyShape(tool, shapeStartRef.current, endPx, layerPixelsRef.current, color, data.width, data.height, mirrorH, mirrorV);
      layerPixelsRef.current = next;
      onLayerChange(activeLayerId, next);
      clearPreview();
      shapeStartRef.current = null;
      onDrawEnd?.();
    } else if (wasDrawing) {
      if (pendingStartRef.current) paint([pendingStartRef.current]);
      onLayerChange(activeLayerId, layerPixelsRef.current);
      onDrawEnd?.();
    }

    isDrawing.current = false;
    lastPixel.current = null;
    drawSessionSnapshot.current = null;
    pendingStartRef.current = null;
  }, [tool, screenToCanvas, data.width, data.height, color, activeLayerId, onLayerChange, paint, clearPreview, mirrorH, mirrorV, onDrawEnd, onNavPointerUp, clearLongPress]);

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
        {refImage && (
          <img
            src={refImage.src}
            alt="Image de référence"
            draggable={false}
            style={{
              position: 'absolute',
              left: refImage.x,
              top: refImage.y,
              width: refImage.naturalWidth * refImage.scale,
              height: 'auto',
              opacity: refImage.opacity,
              pointerEvents: 'none',
            }}
          />
        )}
        <canvas ref={canvasRef} className={styles.canvas} width={data.width} height={data.height} />
        <canvas ref={previewRef} className={styles.preview} width={data.width} height={data.height} />
        <canvas ref={highlightRef} className={styles.highlight} width={displaySize.w} height={displaySize.h} />
      </div>
      {pickerIndicator && (
        <svg
          key={`${pickerIndicator.x},${pickerIndicator.y}`}
          className={styles.pickerIndicator}
          style={{ left: pickerIndicator.x, top: pickerIndicator.y }}
          viewBox="0 0 40 40"
          aria-hidden="true"
        >
          <circle className={styles.pickerIndicatorBg} cx="20" cy="20" r="18" />
          <circle className={styles.pickerIndicatorFg} cx="20" cy="20" r="18" />
        </svg>
      )}
    </div>
  );
}
