import { useCallback, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button, type ButtonSize, type ButtonVariant } from '@/components/Button';
import { Icons, type IconName } from '@/components/Icons';
import { useAnchoredMenu } from '@/hooks/useAnchoredMenu';
import { cx } from '@/lib/cx';
import styles from './Menu.module.scss';

export interface MenuItem {
  label: string;
  onClick: () => void;
  variant?: 'default' | 'danger';
  icon?: IconName;
}

export interface MenuProps {
  items: MenuItem[];
  ariaLabel?: string;
  triggerIcon?: IconName;
  triggerVariant?: ButtonVariant;
  triggerSize?: ButtonSize;
  triggerTitle?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

/** Doit correspondre à `min-width` de `.menu` : largeur supposée avant la première mesure. */
const MENU_FALLBACK_WIDTH = 220;

export function Menu({
  items,
  ariaLabel = 'Options',
  triggerIcon = 'more',
  triggerVariant = 'ghost',
  triggerSize = 'sm',
  triggerTitle,
  open: openProp,
  onOpenChange,
}: MenuProps) {
  const isControlled = openProp !== undefined;
  const [openState, setOpenState] = useState(false);
  const open = isControlled ? openProp : openState;

  const setOpen = useCallback(
    (next: boolean | ((prev: boolean) => boolean)) => {
      const value = typeof next === 'function' ? next(open) : next;
      if (!isControlled) setOpenState(value);
      onOpenChange?.(value);
    },
    [isControlled, onOpenChange, open],
  );

  const close = useCallback(() => setOpen(false), [setOpen]);
  const { rootRef, menuRef, position } = useAnchoredMenu({
    open,
    onDismiss: close,
    fallbackWidth: MENU_FALLBACK_WIDTH,
  });

  return (
    <div
      ref={rootRef}
      className={styles.root}
      onClick={(e) => e.stopPropagation()}
    >
      <Button
        variant={triggerVariant}
        size={triggerSize}
        iconOnly
        iconLeft={triggerIcon}
        title={triggerTitle}
        aria-label={ariaLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      />
      {open && position && createPortal(
        <ul
          ref={menuRef}
          role="menu"
          className={styles.menu}
          style={{ top: position.top, left: position.left }}
          onClick={(e) => e.stopPropagation()}
        >
          {items.map((item, idx) => (
            <li key={item.label} role="none" className={styles.row}>
              <button
                type="button"
                role="menuitem"
                className={cx(styles.item, item.variant === 'danger' && styles.itemDanger)}
                onClick={() => {
                  item.onClick();
                  close();
                }}
              >
                {item.icon && <Icons className={styles.icon} icon={item.icon} />}
                <span className={styles.label}>{item.label}</span>
              </button>
              {idx < items.length - 1 && <span className={styles.divider} aria-hidden="true" />}
            </li>
          ))}
        </ul>,
        document.body,
      )}
    </div>
  );
}
