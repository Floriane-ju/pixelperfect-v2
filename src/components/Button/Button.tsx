import { forwardRef } from 'react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import styles from './Button.module.scss';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  iconLeft?: ReactNode;
  iconRight?: ReactNode;
  fullWidth?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      iconLeft,
      iconRight,
      fullWidth = false,
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
      className ?? '',
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <button ref={ref} type={type} className={classes} {...rest}>
        {iconLeft ? <span className={styles.icon}>{iconLeft}</span> : null}
        {children ? <span className={styles.label}>{children}</span> : null}
        {iconRight ? <span className={styles.icon}>{iconRight}</span> : null}
      </button>
    );
  },
);

Button.displayName = 'Button';
