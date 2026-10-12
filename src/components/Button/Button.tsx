import type {
  ButtonHTMLAttributes,
  FocusEvent as ReactFocusEvent,
  PointerEvent as ReactPointerEvent,
  MouseEvent as ReactMouseEvent,
  Ref,
} from 'react';
import styles from './Button.module.scss';
import { Icons, type IconName } from '@/components/Icons';
import { cx } from '@/lib/cx';
import { useLongPressLabel } from './useLongPressLabel';
import { useTooltip } from '@/components/Tooltip';

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
  /** Infobulle au survol d'un bouton icône (texte : `title`, sinon `aria-label`). */
  tooltip?: boolean;
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
  tooltip = true,
  className,
  title,
  children,
  type = 'button',
  onClick,
  onPointerDown,
  onPointerUp,
  onPointerCancel,
  onPointerLeave,
  onPointerMove,
  onPointerEnter,
  onFocus,
  onBlur,
  ref,
  ...rest
}: ButtonProps) {
  if (import.meta.env.DEV && iconOnly && !rest['aria-label']) {
    console.warn('[Button] iconOnly requires aria-label for a11y');
  }

  const ariaLabel = typeof rest['aria-label'] === 'string' ? rest['aria-label'] : undefined;
  const { handlers, consumeFired } = useLongPressLabel(ariaLabel, iconOnly && longPressLabel);
  const withTooltip = iconOnly && tooltip;
  const { triggerProps: tip, tooltip: tooltipNode } = useTooltip(title ?? ariaLabel, withTooltip);

  // Icône 24 px seule dans un bouton carré, 16 px à côté d'un libellé ou dans un petit bouton.
  const iconSize = iconOnly && size !== 'sm' ? ICON_SIZE_LG : ICON_SIZE_SM;

  const classes = cx(
    styles.button,
    styles[`variant-${variant}`],
    styles[`size-${size}`],
    fullWidth && styles.fullWidth,
    iconOnly && styles.iconOnly,
    className
  );

  const compose = <E extends ReactPointerEvent<HTMLButtonElement>>(
    a: ((e: E) => void) | undefined,
    b: ((e: E) => void) | undefined
  ) => {
    if (!a) return b;
    if (!b) return a;
    return (e: E) => {
      a(e);
      b(e);
    };
  };

  const composeFocus =
    (
      a: (e: ReactFocusEvent<HTMLButtonElement>) => void,
      b: ((e: ReactFocusEvent<HTMLButtonElement>) => void) | undefined
    ) =>
    (e: ReactFocusEvent<HTMLButtonElement>) => {
      a(e);
      b?.(e);
    };

  const handleClick = (e: ReactMouseEvent<HTMLButtonElement>) => {
    if (consumeFired()) {
      e.preventDefault();
      return;
    }
    onClick?.(e);
  };

  return (
    <>
      <button
        ref={ref}
        type={type}
        title={withTooltip ? undefined : title}
        className={classes}
        onClick={handleClick}
        onPointerDown={compose(compose(tip.onPointerDown, handlers.onPointerDown), onPointerDown)}
        onPointerUp={compose(handlers.onPointerUp, onPointerUp)}
        onPointerCancel={compose(handlers.onPointerCancel, onPointerCancel)}
        onPointerLeave={compose(
          compose(tip.onPointerLeave, handlers.onPointerLeave),
          onPointerLeave
        )}
        onPointerMove={compose(handlers.onPointerMove, onPointerMove)}
        onPointerEnter={compose(tip.onPointerEnter, onPointerEnter)}
        onFocus={composeFocus(tip.onFocus, onFocus)}
        onBlur={composeFocus(tip.onBlur, onBlur)}
        {...rest}
      >
        {iconLeft ? <Icons className={styles.icon} icon={iconLeft} size={iconSize} /> : null}
        {children ? <span className={styles.label}>{children}</span> : null}
        {iconRight ? <Icons className={styles.icon} icon={iconRight} size={iconSize} /> : null}
      </button>
      {tooltipNode}
    </>
  );
}
