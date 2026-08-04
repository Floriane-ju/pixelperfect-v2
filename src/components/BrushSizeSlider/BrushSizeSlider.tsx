import { useCallback, useId, useRef } from 'react';
import type { KeyboardEvent, PointerEvent } from 'react';
import styles from './BrushSizeSlider.module.scss';

export interface BrushSizeSliderProps {
  value: number;
  min?: number;
  max?: number;
  onChange: (value: number) => void;
  ariaLabel?: string;
}

export function BrushSizeSlider({
  value,
  min = 1,
  max = 16,
  onChange,
  ariaLabel = 'Taille de brosse',
}: BrushSizeSliderProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const labelId = useId();
  const range = max - min;
  const ratio = (value - min) / range;

  const updateFromPointer = useCallback(
    (clientY: number) => {
      const track = trackRef.current;
      if (!track) return;
      const rect = track.getBoundingClientRect();
      const t = 1 - Math.min(1, Math.max(0, (clientY - rect.top) / rect.height));
      const next = Math.round(min + t * range);
      if (next !== value) onChange(next);
    },
    [min, range, value, onChange],
  );

  const handlePointerDown = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      updateFromPointer(e.clientY);
    },
    [updateFromPointer],
  );

  const handlePointerMove = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        updateFromPointer(e.clientY);
      }
    },
    [updateFromPointer],
  );

  const handlePointerUp = useCallback((e: PointerEvent<HTMLDivElement>) => {
    e.currentTarget.releasePointerCapture(e.pointerId);
  }, []);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'ArrowUp' || e.key === 'ArrowRight') {
        e.preventDefault();
        onChange(Math.min(max, value + 1));
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') {
        e.preventDefault();
        onChange(Math.max(min, value - 1));
      } else if (e.key === 'Home') {
        e.preventDefault();
        onChange(min);
      } else if (e.key === 'End') {
        e.preventDefault();
        onChange(max);
      }
    },
    [max, min, value, onChange],
  );

  return (
    <div className={styles.wrapper}>
      <span id={labelId} className={styles.value} aria-hidden="true">{value}</span>
      <div
        ref={trackRef}
        className={styles.track}
        role="slider"
        tabIndex={0}
        aria-label={ariaLabel}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-orientation="vertical"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onKeyDown={handleKeyDown}
      >
        <div className={styles.fill} style={{ height: `${ratio * 100}%` }} />
        <div className={styles.thumb} style={{ bottom: `${ratio * 100}%` }} />
      </div>
    </div>
  );
}
