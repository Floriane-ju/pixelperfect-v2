import { useCallback, useId } from 'react';
import type { ChangeEvent } from 'react';
import { cx } from '@/lib/cx';
import styles from './Slider.module.scss';

export interface SliderProps {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  ariaLabel: string;
  ariaValueText?: string;
  label?: string;
  valueLabel?: string;
  className?: string;
  disabled?: boolean;
}

export function Slider({
  value,
  min,
  max,
  step = 1,
  onChange,
  ariaLabel,
  ariaValueText,
  label,
  valueLabel,
  className,
  disabled = false,
}: SliderProps) {
  const inputId = useId();

  const handleChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      onChange(Number(e.target.value));
    },
    [onChange],
  );

  return (
    <div className={cx(styles.wrapper, disabled && styles.disabled, className)}>
      {(label || valueLabel) && (
        <div className={styles.labelRow}>
          {label && <label htmlFor={inputId}>{label}</label>}
          {valueLabel && <span className={styles.valueLabel}>{valueLabel}</span>}
        </div>
      )}
      <input
        id={inputId}
        type="range"
        className={styles.input}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={handleChange}
        disabled={disabled}
        aria-label={ariaLabel}
        aria-valuetext={ariaValueText}
      />
    </div>
  );
}
