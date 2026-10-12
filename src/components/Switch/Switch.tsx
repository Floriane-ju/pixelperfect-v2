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
  const classes = cx(styles.switch, checked && styles.checked, className);

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
      <span className={styles.track} aria-hidden="true">
        <span className={styles.thumb} />
      </span>
    </button>
  );
}
