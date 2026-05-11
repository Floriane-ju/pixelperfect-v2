import styles from './Canvas.module.scss';

interface PickerIndicatorProps {
  position: { x: number; y: number };
}

export function PickerIndicator({ position }: PickerIndicatorProps) {
  return (
    <svg
      key={`${position.x},${position.y}`}
      className={styles.pickerIndicator}
      style={{ left: position.x, top: position.y }}
      viewBox="0 0 40 40"
      aria-hidden="true"
    >
      <circle className={styles.pickerIndicatorBg} cx="20" cy="20" r="18" />
      <circle className={styles.pickerIndicatorFg} cx="20" cy="20" r="18" />
    </svg>
  );
}
