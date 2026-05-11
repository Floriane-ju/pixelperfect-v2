import styles from './Canvas.module.scss';

interface GridOverlayProps {
  dataWidth: number;
  dataHeight: number;
  displaySize: { w: number; h: number };
}

const MIN_PX_SIZE = 4;

export function GridOverlay({ dataWidth, dataHeight, displaySize }: GridOverlayProps) {
  const pxSize = displaySize.w / dataWidth;
  if (pxSize < MIN_PX_SIZE) return null;

  let d = '';
  for (let i = 1; i < dataWidth; i++) d += `M${i} 0V${dataHeight}`;
  for (let j = 1; j < dataHeight; j++) d += `M0 ${j}H${dataWidth}`;

  return (
    <svg
      className={styles.grid}
      viewBox={`0 0 ${dataWidth} ${dataHeight}`}
      preserveAspectRatio="none"
      aria-hidden="true"
      shapeRendering="geometricPrecision"
    >
      <path d={d} className={styles.gridPath} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
