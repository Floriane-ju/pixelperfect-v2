import type { ButtonHTMLAttributes, PointerEvent as ReactPointerEvent, MouseEvent as ReactMouseEvent, Ref } from 'react';
import styles from './Button.module.scss';
import { Icons, type IconName } from '@/components/Icons';
import { cx } from '@/lib/cx';
import { useLongPressLabel } from './useLongPressLabel';

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'ghost'
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
  ref?: Ref<HTMLButtonElement>;
}

export function Button({
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
  ref,
  ...rest
}: ButtonProps) {
  if (import.meta.env.DEV && iconOnly && !rest['aria-label']) {
    console.warn('[Button] iconOnly requires aria-label for a11y');
  }

  const ariaLabel = typeof rest['aria-label'] === 'string' ? rest['aria-label'] : undefined;
  const { handlers, consumeFired } = useLongPressLabel(ariaLabel, iconOnly);

  const classes = cx(
    styles.button,
    styles[`variant-${variant}`],
    styles[`size-${size}`],
    fullWidth && styles.fullWidth,
    iconOnly && styles.iconOnly,
    className,
  );

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
      {iconLeft ? <Icons className={styles.icon} icon={iconLeft} /> : null}
      {children ? <span className={styles.label}>{children}</span> : null}
      {iconRight ? <Icons className={styles.icon} icon={iconRight} /> : null}
    </button>
  );
}
