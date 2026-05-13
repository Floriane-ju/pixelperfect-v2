import type { RefObject } from 'react';
import type { SelectionRect } from './selectionRect';
import type { RefImageState } from '@/routes/Editor/hooks/useReferenceImage';
import { GridOverlay } from './GridOverlay';
import styles from './Canvas.module.scss';

interface CanvasStackProps {
  checkerRef: RefObject<HTMLCanvasElement>;
  canvasRef: RefObject<HTMLCanvasElement>;
  previewRef: RefObject<HTMLCanvasElement>;
  highlightRef: RefObject<HTMLCanvasElement>;
  dataWidth: number;
  dataHeight: number;
  displaySize: { w: number; h: number };
  refImage: RefImageState | null | undefined;
  showGrid: boolean;
  selectionRect: SelectionRect | null;
}

export function CanvasStack({
  checkerRef,
  canvasRef,
  previewRef,
  highlightRef,
  dataWidth,
  dataHeight,
  displaySize,
  refImage,
  showGrid,
  selectionRect,
}: CanvasStackProps) {
  return (
    <>
      <canvas ref={checkerRef} className={styles.checker} width={dataWidth} height={dataHeight} />
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
      <canvas ref={canvasRef} className={styles.canvas} width={dataWidth} height={dataHeight} />
      <canvas ref={previewRef} className={styles.preview} width={dataWidth} height={dataHeight} />
      <canvas ref={highlightRef} className={styles.highlight} width={displaySize.w} height={displaySize.h} />
      {showGrid && <GridOverlay dataWidth={dataWidth} dataHeight={dataHeight} displaySize={displaySize} />}
      {selectionRect && (
        <svg
          className={styles.selection}
          viewBox={`0 0 ${dataWidth} ${dataHeight}`}
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <rect
            className={styles.selectionRect}
            x={selectionRect.x}
            y={selectionRect.y}
            width={selectionRect.w}
            height={selectionRect.h}
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      )}
    </>
  );
}
