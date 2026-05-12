import { forwardRef } from 'react';
import type { ButtonHTMLAttributes, PointerEvent as ReactPointerEvent, MouseEvent as ReactMouseEvent } from 'react';
import styles from './Button.module.scss';
import { Icons, type IconName } from '@/components/Icons';
import { useLongPressLabel } from './useLongPressLabel';

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'ghost'
  | 'ghost-accent-1'
  | 'danger'
  | 'selected'
  | 'selectable';
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
      onClick,
      onPointerDown,
      onPointerUp,
      onPointerCancel,
      onPointerLeave,
      onPointerMove,
      ...rest
    },
    ref,
  ) => {
    if (import.meta.env.DEV && iconOnly && !rest['aria-label']) {
      console.warn('[Button] iconOnly requires aria-label for a11y');
    }

    const ariaLabel = typeof rest['aria-label'] === 'string' ? rest['aria-label'] : undefined;
    const { handlers, consumeFired } = useLongPressLabel(ariaLabel, iconOnly);

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

    const compose = <E extends ReactPointerEvent<HTMLButtonElement>>(
      a: ((e: E) => void) | undefined,
      b: ((e: E) => void) | undefined,
    ) => {
      if (!a) return b;
      if (!b) return a;
      return (e: E) => {
        a(e);
        b(e);
      };
    };

    const handleClick = (e: ReactMouseEvent<HTMLButtonElement>) => {
      if (consumeFired()) {
        e.preventDefault();
        return;
      }
      onClick?.(e);
    };

    return (
      <button
        ref={ref}
        type={type}
        className={classes}
        onClick={handleClick}
        onPointerDown={compose(handlers.onPointerDown, onPointerDown)}
        onPointerUp={compose(handlers.onPointerUp, onPointerUp)}
        onPointerCancel={compose(handlers.onPointerCancel, onPointerCancel)}
        onPointerLeave={compose(handlers.onPointerLeave, onPointerLeave)}
        onPointerMove={compose(handlers.onPointerMove, onPointerMove)}
        {...rest}
      >
        {iconLeft ? <Icons className={styles.icon} icon={iconLeft} size={24} /> : null}
        {children ? <span className={styles.label}>{children}</span> : null}
        {iconRight ? <Icons className={styles.icon} icon={iconRight} size={24} /> : null}
      </button>
    );
  },
);

Button.displayName = 'Button';
