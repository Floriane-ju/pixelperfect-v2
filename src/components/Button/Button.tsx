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
  | 'selectable'
  /** Sur fond encre (dock, rails) : `aria-pressed` → papier, `aria-current` → rouge. */
  | 'ink';
const ICON_SIZE_SM = 16;
const ICON_SIZE_LG = 24;

export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  iconLeft?: IconName;
  iconRight?: IconName;
  fullWidth?: boolean;
  iconOnly?: boolean;
  /** Appui long tactile sur un bouton icône → libellé en snackbar. À couper si l'appui long sert déjà. */
  longPressLabel?: boolean;
  ref?: Ref<HTMLButtonElement>;
}

export function Button({
  variant = 'primary',
  size = 'md',
  iconLeft,
  iconRight,
  fullWidth = false,
  iconOnly = false,
  longPressLabel = true,
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
  const { handlers, consumeFired } = useLongPressLabel(ariaLabel, iconOnly && longPressLabel);

  // Icône 24 px seule dans un bouton carré, 16 px à côté d'un libellé ou dans un petit bouton.
  const iconSize = iconOnly && size !== 'sm' ? ICON_SIZE_LG : ICON_SIZE_SM;

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
      {iconLeft ? <Icons className={styles.icon} icon={iconLeft} size={iconSize} /> : null}
      {children ? <span className={styles.label}>{children}</span> : null}
      {iconRight ? <Icons className={styles.icon} icon={iconRight} size={iconSize} /> : null}
    </button>
  );
}
