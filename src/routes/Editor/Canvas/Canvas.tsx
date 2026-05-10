import { useCallback, useEffect, useRef, useState } from 'react';
import type { DrawingData, HexColor } from '@/types';
import { bresenham, expandMirror, floodFill, getShapePixels } from '@/routes/Editor/shapePixels';
import { isShapeTool, applyShape } from './shapes';
import type { Tool } from './shapes';
import { useCanvasNavigation } from './useCanvasNavigation';
import styles from './Canvas.module.scss';

export type { Tool };

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
  mirrorH: boolean;
  mirrorV: boolean;
  onLayerChange: (layerId: string, pixels: Record<string, HexColor>) => void;
  onInvisibleLayerAttempt: () => void;
  onDrawStart?: () => void;
  onDrawEnd?: () => void;
  hoveredColor?: HexColor | null;
  refImage?: RefImageState | null;
  onDisplaySizeChange?: (size: { w: number; h: number }) => void;
}

export function Canvas({ data, activeLayerId, tool, color, mirrorH, mirrorV, onLayerChange, onInvisibleLayerAttempt, onDrawStart, onDrawEnd, hoveredColor, refImage, onDisplaySizeChange }: CanvasProps) {
  const checkerRef = useRef<HTMLCanvasElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewRef = useRef<HTMLCanvasElement>(null);
  const highlightRef = useRef<HTMLCanvasElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const displaySizeRef = useRef({ w: 256, h: 256 });
  const [displaySize, setDisplaySize] = useState({ w: 256, h: 256 });

  const { transform, transformRef, onNavPointerDown, onNavPointerMove, onNavPointerUp } = useCanvasNavigation(wrapperRef);

  const isDrawing = useRef(false);
  const lastPixel = useRef<{ x: number; y: number } | null>(null);
  const layerPixelsRef = useRef<Record<string, HexColor>>({});
  const drawSessionSnapshot = useRef<Record<string, HexColor> | null>(null);
  const shapeStartRef = useRef<{ x: number; y: number } | null>(null);

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

  // Highlight pixels matching hoveredColor
  useEffect(() => {
    const canvas = highlightRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, data.width, data.height);
    if (!hoveredColor) return;
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
        ctx.fillRect(parseInt(key.slice(0, comma), 10) + 0.25, parseInt(key.slice(comma + 1), 10) + 0.25, 0.5, 0.5);
      }
    }
  }, [hoveredColor, data]);

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
    wrapperRef.current?.setPointerCapture(e.pointerId);
    const navResult = onNavPointerDown(e.pointerId, e.clientX, e.clientY, e.button, e.target === canvasRef.current);

    if (navResult === 'cancel') {
      if (isDrawing.current && drawSessionSnapshot.current !== null) {
        layerPixelsRef.current = drawSessionSnapshot.current;
        onLayerChange(activeLayerId, drawSessionSnapshot.current);
      }
      clearPreview();
      shapeStartRef.current = null;
      isDrawing.current = false;
      lastPixel.current = null;
      drawSessionSnapshot.current = null;
      return;
    }

    if (navResult !== 'draw') return;

    const activeLayer = data.layers.find(l => l.id === activeLayerId);
    if (activeLayer && !activeLayer.visible) {
      onInvisibleLayerAttempt();
      onNavPointerUp(e.pointerId);
      wrapperRef.current?.releasePointerCapture(e.pointerId);
      return;
    }

    const px = screenToCanvas(e.clientX, e.clientY);

    if (tool === 'fill') {
      onDrawStart?.();
      const filled = floodFill(layerPixelsRef.current, px.x, px.y, data.width, data.height, color);
      if (filled) { layerPixelsRef.current = filled; onLayerChange(activeLayerId, filled); }
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
  }, [data.layers, data.width, data.height, activeLayerId, tool, color, onInvisibleLayerAttempt, screenToCanvas, paint, onLayerChange, drawPreview, clearPreview, onDrawStart, onDrawEnd, onNavPointerDown, onNavPointerUp]);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (onNavPointerMove(e.pointerId, e.clientX, e.clientY)) return;
    if (!isDrawing.current) return;
    const px = screenToCanvas(e.clientX, e.clientY);
    if (isShapeTool(tool) && shapeStartRef.current) {
      drawPreview(getShapePixels(tool, shapeStartRef.current, px));
      return;
    }
    const last = lastPixel.current;
    paint(last ? bresenham(last.x, last.y, px.x, px.y) : [px]);
    lastPixel.current = px;
  }, [onNavPointerMove, screenToCanvas, paint, tool, drawPreview]);

  const handlePointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    wrapperRef.current?.releasePointerCapture(e.pointerId);
    onNavPointerUp(e.pointerId);

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
      onDrawEnd?.();
    }

    isDrawing.current = false;
    lastPixel.current = null;
    drawSessionSnapshot.current = null;
  }, [tool, screenToCanvas, data.width, data.height, color, activeLayerId, onLayerChange, clearPreview, mirrorH, mirrorV, onDrawEnd, onNavPointerUp]);

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
        <canvas ref={highlightRef} className={styles.highlight} width={data.width} height={data.height} />
      </div>
    </div>
  );
}
