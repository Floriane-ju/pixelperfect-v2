import { forwardRef } from 'react';
import type { ButtonHTMLAttributes } from 'react';
import styles from './Button.module.scss';
import { Icons, type IconName } from '@/components/Icons';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'selected' | 'selectable';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  iconLeft?: IconName;
  iconRight?: IconName;
  fullWidth?: boolean;
  iconOnly?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      iconLeft,
      iconRight,
      fullWidth = false,
      iconOnly = false,
      className,
      children,
      type = 'button',
      ...rest
    },
    ref,
  ) => {
    const classes = [
      styles.button,
      styles[`variant-${variant}`],
      styles[`size-${size}`],
      fullWidth ? styles.fullWidth : '',
      iconOnly ? styles.iconOnly : '',
      className ?? '',
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <button ref={ref} type={type} className={classes} {...rest}>
        {iconLeft ? <Icons className={styles.icon} icon={iconLeft} size={24} /> : null}
        {children ? <span className={styles.label}>{children}</span> : null}
        {iconRight ? <Icons className={styles.icon} icon={iconRight} size={24} /> : null}
      </button>
    );
  },
);

Button.displayName = 'Button';
