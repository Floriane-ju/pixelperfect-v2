import { useCallback, useEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
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

function getMenuItems(menu: HTMLElement | null): HTMLButtonElement[] {
  return menu ? Array.from(menu.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')) : [];
}

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
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Vrai une seule fois à l'ouverture (pas à chaque recalage de position) : sinon le focus
  // reviendrait au premier élément à chaque scroll.
  const ready = open && position !== null;
  useEffect(() => {
    if (ready) getMenuItems(menuRef.current)[0]?.focus();
  }, [ready, menuRef]);

  const handleMenuKeyDown = (e: KeyboardEvent<HTMLUListElement>) => {
    const items = getMenuItems(menuRef.current);
    const current = items.indexOf(document.activeElement as HTMLButtonElement);
    let target: number;
    switch (e.key) {
      case 'ArrowDown': target = (current + 1) % items.length; break;
      case 'ArrowUp': target = current <= 0 ? items.length - 1 : current - 1; break;
      case 'Home': target = 0; break;
      case 'End': target = items.length - 1; break;
      // La fermeture reste à useAnchoredMenu (listener document, plus loin) : on ramène seulement
      // le focus au déclencheur avant que les items ne se démontent.
      case 'Escape': triggerRef.current?.focus(); return;
      // Menu porté en fin de body : Tab sortirait de l'ordre de focus en le laissant ouvert.
      case 'Tab': e.preventDefault(); triggerRef.current?.focus(); close(); return;
      default: return;
    }
    e.preventDefault();
    items[target]?.focus();
  };

  return (
    <div
      ref={rootRef}
      className={styles.root}
      onClick={(e) => e.stopPropagation()}
    >
      <Button
        ref={triggerRef}
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
          onKeyDown={handleMenuKeyDown}
        >
          {items.map((item, idx) => (
            <li key={item.label} role="none" className={styles.row}>
              <button
                type="button"
                role="menuitem"
                className={cx(styles.item, item.variant === 'danger' && styles.itemDanger)}
                onClick={() => {
                  // Le menu va se démonter : le focus revient d'abord au déclencheur, pour qu'une
                  // modale ouverte par l'action le mémorise comme élément à restaurer.
                  triggerRef.current?.focus();
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
