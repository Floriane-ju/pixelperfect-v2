import { useCallback, useEffect, useRef, useState } from 'react';
import type { PointerEvent } from 'react';
import type { DrawingData, HexColor } from '@/types';
import { bresenham, expandSymmetry, floodFill, getShapePixels } from '@/routes/Editor/shapePixels';
import type { SymmetryConfig } from '@/routes/Editor/shapePixels';
import { isShapeTool, applyShape } from './shapes';
import type { Tool } from './shapes';
import { useCanvasNavigation } from './useCanvasNavigation';
import { useCheckerboard } from './useCheckerboard';
import { useHighlightOverlay } from './useHighlightOverlay';
import { useSelectionPreview } from './useSelectionPreview';
import { useResponsiveDisplaySize } from './useResponsiveDisplaySize';
import { useLayerComposite } from './useLayerComposite';
import { computeSelectionRect } from './selectionRect';
import { stampBrush, applyBrushPixels, restoreLayerFromSnapshot, pickColorAt as pickColorFrom } from './drawUtils';
import { CanvasStack } from './CanvasStack';
import { PickerIndicator } from './PickerIndicator';
import type { UseSelectionApi } from '@/routes/Editor/hooks/useSelection';
import type { RefImageState } from '@/routes/Editor/hooks/useReferenceImage';
import styles from './Canvas.module.scss';

export type { Tool };

const PIPETTE_HOLD_MS = 500;
const PIPETTE_INDICATOR_DELAY_MS = 200;

interface CanvasProps {
  data: DrawingData;
  activeLayerId: string;
  tool: Tool;
  color: HexColor;
  brushSize?: number;
  symmetry: SymmetryConfig;
  onLayerChange: (layerId: string, pixels: Record<string, HexColor>) => void;
  onInvisibleLayerAttempt: () => void;
  onDrawStart?: () => void;
  onDrawEnd?: () => void;
  onPickColor?: (color: HexColor) => void;
  onTwoFingerTap?: () => void;
  hoveredColor?: HexColor | null;
  refImage?: RefImageState | null;
  onDisplaySizeChange?: (size: { w: number; h: number }) => void;
  showGrid?: boolean;
  selection?: UseSelectionApi;
  title?: string;
  /** Lecture d'animation : navigation (pan, pinch, molette) seule, aucun outil. */
  readOnly?: boolean;
}

export function Canvas({
  data,
  activeLayerId,
  tool,
  color,
  brushSize = 1,
  symmetry,
  onLayerChange,
  onInvisibleLayerAttempt,
  onDrawStart,
  onDrawEnd,
  onPickColor,
  onTwoFingerTap,
  hoveredColor,
  refImage,
  onDisplaySizeChange,
  showGrid = false,
  selection,
  title,
  readOnly = false,
}: CanvasProps) {
  const checkerRef = useRef<HTMLCanvasElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewRef = useRef<HTMLCanvasElement>(null);
  const highlightRef = useRef<HTMLCanvasElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const [pickerIndicator, setPickerIndicator] = useState<{ x: number; y: number } | null>(null);

  const { displaySize, displaySizeRef } = useResponsiveDisplaySize(wrapperRef, data.width, data.height, onDisplaySizeChange);
  const { transform, transformRef, onNavPointerDown, onNavPointerMove, onNavPointerUp } = useCanvasNavigation(wrapperRef, displaySizeRef);
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
  // Fill / pipette : action différée au pointerup, annulée si un 2e doigt arrive (pinch).
  const tapRef = useRef<{ pointerId: number; px: { x: number; y: number }; tool: 'fill' | 'eyedropper' } | null>(null);
  const strokeChangedRef = useRef(false);

  const resetStroke = useCallback(() => {
    isDrawing.current = false; lastPixel.current = null; drawSessionSnapshot.current = null;
    shapeStartRef.current = null; pendingStartRef.current = null; tapRef.current = null;
    strokeChangedRef.current = false; longPressFiredRef.current = false;
  }, []);

  // Geste de sélection interrompu (pinch) : ni définition ni déplacement ne doivent survivre.
  const cancelSelectionGesture = useCallback(() => {
    if (!selection) return;
    selection.endMove();
    if (selection.state.kind === 'defining') selection.cancel();
  }, [selection]);

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

  // Quitter l'éditeur pendant un appui long : le minuteur pipette ne doit pas se déclencher après coup.
  useEffect(() => clearLongPress, [clearLongPress]);

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
    for (const { x, y } of expandSymmetry(pts, data.width, data.height, symmetry)) {
      if (x >= 0 && y >= 0 && x < data.width && y < data.height) ctx.fillRect(x, y, 1, 1);
    }
  }, [data.width, data.height, color, symmetry]);

  const clearPreview = useCallback(() => {
    previewRef.current?.getContext('2d')?.clearRect(0, 0, data.width, data.height);
  }, [data.width, data.height]);

  // Abandon du geste en cours : restaure le snapshot de stroke, ne committe rien.
  const abortGesture = useCallback(() => {
    clearLongPress();
    if (isDrawing.current) restoreDrawSession();
    clearPreview();
    cancelSelectionGesture();
    resetStroke();
  }, [clearLongPress, restoreDrawSession, clearPreview, cancelSelectionGesture, resetStroke]);

  const paint = useCallback((pixels: Array<{ x: number; y: number }>) => {
    const stamped = stampBrush(pixels, brushSize);
    const expanded = expandSymmetry(stamped, data.width, data.height, symmetry);
    const active = layerCanvasesRef.current.get(activeLayerId);
    const lctx = active?.canvas.getContext('2d') ?? null;
    const changed = applyBrushPixels(layerPixelsRef.current, lctx, expanded, tool === 'eraser', color, data.width, data.height);
    if (changed) {
      strokeChangedRef.current = true;
      recompositeMain();
    }
  }, [tool, color, brushSize, activeLayerId, data.width, data.height, symmetry, layerCanvasesRef, layerPixelsRef, recompositeMain]);

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
      resetStroke();
      longPressFiredRef.current = true;
      longPressTimerRef.current = null;
      pressOriginRef.current = null;
      setPickerIndicator(null);
    }, PIPETTE_HOLD_MS);
  }, [clearPreview, pickColorAt, restoreDrawSession, resetStroke]);

  const handlePointerDown = useCallback((e: PointerEvent<HTMLDivElement>) => {
    wrapperRef.current?.setPointerCapture(e.pointerId);
    const navResult = onNavPointerDown(e.pointerId, e.clientX, e.clientY, e.button, e.target === canvasRef.current);

    if (navResult === 'cancel') {
      abortGesture();
      return;
    }

    if (navResult !== 'draw' || readOnly) return;

    const px = screenToCanvas(e.clientX, e.clientY);

    if (tool === 'eyedropper') {
      tapRef.current = { pointerId: e.pointerId, px, tool };
      return;
    }

    // Avant la sélection aussi : lever des pixels d'un calque masqué est une édition à l'aveugle.
    const activeLayer = data.layers.find(l => l.id === activeLayerId);
    if (activeLayer && !activeLayer.visible) {
      onInvisibleLayerAttempt();
      onNavPointerUp(e.pointerId);
      wrapperRef.current?.releasePointerCapture(e.pointerId);
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

    if (tool === 'fill') {
      tapRef.current = { pointerId: e.pointerId, px, tool };
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
    strokeChangedRef.current = false;
    lastPixel.current = px;
    pendingStartRef.current = px;
    schedulePipetteLongPress(e.clientX, e.clientY, px);
  }, [data.layers, activeLayerId, tool, layerCanvasesRef, layerPixelsRef, onInvisibleLayerAttempt, screenToCanvas, drawPreview, onDrawStart, onNavPointerDown, onNavPointerUp, schedulePipetteLongPress, selection, abortGesture, readOnly]);

  const handlePointerMove = useCallback((e: PointerEvent<HTMLDivElement>) => {
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

  const commitTap = useCallback((tap: { px: { x: number; y: number }; tool: 'fill' | 'eyedropper' }) => {
    if (tap.tool === 'eyedropper') { pickColorAt(tap.px); return; }
    const filled = floodFill(layerPixelsRef.current, tap.px.x, tap.px.y, data.width, data.height, color);
    if (!filled) return;
    onDrawStart?.();
    layerPixelsRef.current = filled;
    onLayerChange(activeLayerId, filled);
    onDrawEnd?.();
  }, [pickColorAt, layerPixelsRef, data.width, data.height, color, activeLayerId, onDrawStart, onLayerChange, onDrawEnd]);

  const handlePointerUp = useCallback((e: PointerEvent<HTMLDivElement>) => {
    wrapperRef.current?.releasePointerCapture(e.pointerId);
    if (onNavPointerUp(e.pointerId)) onTwoFingerTap?.();
    clearLongPress();

    if (longPressFiredRef.current) { resetStroke(); return; }

    const tap = tapRef.current;
    if (tap?.pointerId === e.pointerId) { resetStroke(); commitTap(tap); return; }

    if (tool === 'select' && selection) {
      if (selection.state.kind === 'defining') selection.finishDefining();
      else if (selection.state.kind === 'floating') selection.endMove();
      resetStroke();
      return;
    }

    if (isDrawing.current && isShapeTool(tool) && shapeStartRef.current) {
      const endPx = screenToCanvas(e.clientX, e.clientY);
      const before = layerPixelsRef.current;
      const next = applyShape(tool, shapeStartRef.current, endPx, before, color, data.width, data.height, symmetry);
      clearPreview();
      if (next !== before) {
        layerPixelsRef.current = next;
        onLayerChange(activeLayerId, next);
        onDrawEnd?.();
      }
    } else if (isDrawing.current) {
      if (pendingStartRef.current) paint([pendingStartRef.current]);
      if (strokeChangedRef.current) {
        onLayerChange(activeLayerId, layerPixelsRef.current);
        onDrawEnd?.();
      }
    }
    resetStroke();
  }, [tool, screenToCanvas, data.width, data.height, color, activeLayerId, layerPixelsRef, onLayerChange, paint, clearPreview, symmetry, onDrawEnd, onNavPointerUp, clearLongPress, selection, resetStroke, commitTap, onTwoFingerTap]);

  // Annulation système (appel entrant, perte de focus…) : jamais de commit ni d'entrée d'historique.
  const handlePointerCancel = useCallback((e: PointerEvent<HTMLDivElement>) => {
    wrapperRef.current?.releasePointerCapture(e.pointerId);
    onNavPointerUp(e.pointerId);
    abortGesture();
  }, [onNavPointerUp, abortGesture]);

  const cssSize = { width: displaySize.w, height: displaySize.h };
  const { x, y, scale, angle } = transform;
  const selectionRect = computeSelectionRect(selection?.state);
  const canvasAriaLabel = title ? `Dessin « ${title} » : ${data.width}×${data.height} pixels, ${data.layers.length} calque${data.layers.length > 1 ? 's' : ''}` : undefined;

  return (
    <div
      ref={wrapperRef}
      id="canvas"
      className={styles.wrapper}
      tabIndex={-1}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
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
          canvasAriaLabel={canvasAriaLabel}
        />
      </div>
      {pickerIndicator && <PickerIndicator position={pickerIndicator} />}
    </div>
  );
}
