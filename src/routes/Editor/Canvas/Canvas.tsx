import { useCallback, useEffect, useRef, useState } from 'react';
import type { DrawingData, HexColor } from '@/types';
import { bresenham, expandMirror, floodFill, getShapePixels } from '@/routes/Editor/shapePixels';
import { isShapeTool, applyShape } from './shapes';
import type { Tool } from './shapes';
import { useCanvasNavigation } from './useCanvasNavigation';
import { useCheckerboard } from './useCheckerboard';
import { useHighlightOverlay } from './useHighlightOverlay';
import { useSelectionPreview } from './useSelectionPreview';
import { useResponsiveDisplaySize } from './useResponsiveDisplaySize';
import { useLayerComposite } from './useLayerComposite';
import { computeSelectionRect } from './selectionRect';
import { stampBrush, restoreLayerFromSnapshot, pickColorAt as pickColorFrom } from './drawUtils';
import { CanvasStack } from './CanvasStack';
import { PickerIndicator } from './PickerIndicator';
import type { UseSelectionApi } from '@/routes/Editor/hooks/useSelection';
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
  showGrid?: boolean;
  selection?: UseSelectionApi;
}

export function Canvas({
  data,
  activeLayerId,
  tool,
  color,
  brushSize = 1,
  mirrorH,
  mirrorV,
  onLayerChange,
  onInvisibleLayerAttempt,
  onDrawStart,
  onDrawEnd,
  onPickColor,
  hoveredColor,
  refImage,
  onDisplaySizeChange,
  showGrid = false,
  selection,
}: CanvasProps) {
  const checkerRef = useRef<HTMLCanvasElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewRef = useRef<HTMLCanvasElement>(null);
  const highlightRef = useRef<HTMLCanvasElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const [pickerIndicator, setPickerIndicator] = useState<{ x: number; y: number } | null>(null);

  const { displaySize, displaySizeRef } = useResponsiveDisplaySize(wrapperRef, data.width, data.height, onDisplaySizeChange);
  const { transform, transformRef, onNavPointerDown, onNavPointerMove, onNavPointerUp } = useCanvasNavigation(wrapperRef);
  const { layerCanvasesRef, layerPixelsRef, recompositeMain } = useLayerComposite({ mainCanvasRef: canvasRef, data, activeLayerId });

  useCheckerboard(checkerRef, data.width, data.height);
  useHighlightOverlay({ canvasRef: highlightRef, hoveredColor, data, displaySize });
  useSelectionPreview({ canvasRef: previewRef, state: selection?.state, dataWidth: data.width, dataHeight: data.height });

  const isDrawing = useRef(false);
  const lastPixel = useRef<{ x: number; y: number } | null>(null);
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
    const c = pickColorFrom(canvasRef.current, px, data.width, data.height);
    if (c) onPickColor?.(c);
  }, [data.width, data.height, onPickColor]);

  const restoreDrawSession = useCallback(() => {
    const snapshot = drawSessionSnapshot.current;
    if (!snapshot) return;
    layerPixelsRef.current = snapshot;
    const active = layerCanvasesRef.current.get(activeLayerId);
    if (active) {
      active.pixelsRef = layerPixelsRef.current;
      restoreLayerFromSnapshot(snapshot, active.canvas, data.width, data.height);
    }
    recompositeMain();
  }, [activeLayerId, data.width, data.height, layerCanvasesRef, layerPixelsRef, recompositeMain]);

  // Listen to data prop change to keep layerPixelsRef in sync with active layer.
  useEffect(() => {
    if (isDrawing.current) return;
    const layer = data.layers.find(l => l.id === activeLayerId);
    layerPixelsRef.current = layer ? { ...layer.pixels } : {};
  }, [data, activeLayerId, layerPixelsRef]);

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
  }, [data.width, data.height, displaySizeRef, transformRef]);

  const drawPreview = useCallback((pts: Array<{ x: number; y: number }>) => {
    const ctx = previewRef.current?.getContext('2d');
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
    if (changed) recompositeMain();
  }, [tool, color, brushSize, activeLayerId, data.width, data.height, mirrorH, mirrorV, layerCanvasesRef, layerPixelsRef, recompositeMain]);

  const schedulePipetteLongPress = useCallback((sx: number, sy: number, canvasPx: { x: number; y: number }) => {
    longPressFiredRef.current = false;
    pressOriginRef.current = { sx, sy };
    indicatorTimerRef.current = window.setTimeout(() => {
      const wr = wrapperRef.current?.getBoundingClientRect();
      if (wr) setPickerIndicator({ x: sx - wr.left, y: sy - wr.top });
      indicatorTimerRef.current = null;
    }, PIPETTE_INDICATOR_DELAY_MS);
    longPressTimerRef.current = window.setTimeout(() => {
      restoreDrawSession();
      clearPreview();
      pickColorAt(canvasPx);
      isDrawing.current = false;
      lastPixel.current = null;
      drawSessionSnapshot.current = null;
      shapeStartRef.current = null;
      longPressFiredRef.current = true;
      longPressTimerRef.current = null;
      pressOriginRef.current = null;
      setPickerIndicator(null);
    }, PIPETTE_HOLD_MS);
  }, [clearPreview, pickColorAt, restoreDrawSession]);

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    wrapperRef.current?.setPointerCapture(e.pointerId);
    const navResult = onNavPointerDown(e.pointerId, e.clientX, e.clientY, e.button, e.target === canvasRef.current);

    if (navResult === 'cancel') {
      clearLongPress();
      if (isDrawing.current) restoreDrawSession();
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

    if (tool === 'select' && selection) {
      if (selection.state.kind === 'floating') {
        if (selection.isInsideFloating(px)) selection.startMove(px);
        else { selection.commit(); selection.startDefining(px); }
      } else {
        selection.startDefining(px);
      }
      isDrawing.current = true;
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

    if (isShapeTool(tool)) {
      onDrawStart?.();
      drawSessionSnapshot.current = { ...layerPixelsRef.current };
      isDrawing.current = true;
      shapeStartRef.current = px;
      drawPreview([px]);
      schedulePipetteLongPress(e.clientX, e.clientY, px);
      return;
    }

    onDrawStart?.();
    drawSessionSnapshot.current = { ...layerPixelsRef.current };
    const activeEntry = layerCanvasesRef.current.get(activeLayerId);
    if (activeEntry) activeEntry.pixelsRef = layerPixelsRef.current;
    isDrawing.current = true;
    lastPixel.current = px;
    pendingStartRef.current = px;
    schedulePipetteLongPress(e.clientX, e.clientY, px);
  }, [data.layers, data.width, data.height, activeLayerId, tool, color, layerCanvasesRef, layerPixelsRef, onInvisibleLayerAttempt, pickColorAt, screenToCanvas, onLayerChange, drawPreview, clearPreview, onDrawStart, onDrawEnd, onNavPointerDown, onNavPointerUp, restoreDrawSession, clearLongPress, schedulePipetteLongPress, selection]);

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
    if (tool === 'select' && selection) {
      if (selection.state.kind === 'defining') selection.updateDefining(px);
      else if (selection.state.kind === 'floating') selection.moveTo(px);
      return;
    }
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
  }, [onNavPointerMove, screenToCanvas, paint, tool, drawPreview, clearLongPress, selection]);

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

    if (tool === 'select' && selection) {
      if (selection.state.kind === 'defining') selection.finishDefining();
      else if (selection.state.kind === 'floating') selection.endMove();
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
  }, [tool, screenToCanvas, data.width, data.height, color, activeLayerId, layerPixelsRef, onLayerChange, paint, clearPreview, mirrorH, mirrorV, onDrawEnd, onNavPointerUp, clearLongPress, selection]);

  const cssSize = { width: displaySize.w, height: displaySize.h };
  const { x, y, scale, angle } = transform;
  const selectionRect = computeSelectionRect(selection?.state);

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
        <CanvasStack
          checkerRef={checkerRef}
          canvasRef={canvasRef}
          previewRef={previewRef}
          highlightRef={highlightRef}
          dataWidth={data.width}
          dataHeight={data.height}
          displaySize={displaySize}
          refImage={refImage}
          showGrid={showGrid}
          selectionRect={selectionRect}
        />
      </div>
      {pickerIndicator && <PickerIndicator position={pickerIndicator} />}
    </div>
  );
}
