import type { ButtonHTMLAttributes, Ref } from 'react';
import { cx } from '@/lib/cx';
import styles from './Switch.module.scss';

export interface SwitchProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onChange'> {
  checked: boolean;
  onChange: (checked: boolean) => void;
  ref?: Ref<HTMLButtonElement>;
}

export function Switch({ checked, onChange, disabled, className, ref, ...rest }: SwitchProps) {
  const classes = cx(styles.switch, className);

  return (
    <button
      ref={ref}
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      className={classes}
      onClick={() => onChange(!checked)}
      {...rest}
    >
      <SwitchTrack checked={checked} />
    </button>
  );
}

/** Visuel seul de l'interrupteur, pour un contrôle porté par un autre élément (item de menu). */
export function SwitchTrack({ checked }: { checked: boolean }) {
  return (
    <span className={cx(styles.track, checked && styles.checked)} aria-hidden="true">
      <span className={styles.thumb} />
    </span>
  );
}
