import { useCallback, useEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { Button, type ButtonSize, type ButtonVariant } from '@/components/Button';
import { Icons, type IconName } from '@/components/Icons';
import { SwitchTrack } from '@/components/Switch';
import { useAnchoredMenu } from '@/hooks/useAnchoredMenu';
import { cx } from '@/lib/cx';
import styles from './Menu.module.scss';

export interface MenuItem {
  label: string;
  onClick: () => void;
  variant?: 'default' | 'danger';
  icon?: IconName;
  /** Interrupteur : l'item bascule (`onClick`) sans fermer le menu. */
  checked?: boolean;
  disabled?: boolean;
  /** Bouton icône à droite de l'item (ex. copier). */
  action?: { icon: IconName; label: string; onClick: () => void };
}

export interface MenuProps {
  items: MenuItem[];
  ariaLabel?: string;
  triggerIcon?: IconName;
  triggerVariant?: ButtonVariant;
  triggerSize?: ButtonSize;
  triggerTitle?: string;
  /** Libellé visible du déclencheur ; sans lui, le déclencheur est un bouton icône. */
  triggerLabel?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

/** Doit correspondre à `min-width` de `.menu` : largeur supposée avant la première mesure. */
const MENU_FALLBACK_WIDTH = 208;

function getMenuItems(menu: HTMLElement | null): HTMLButtonElement[] {
  return menu ? Array.from(menu.querySelectorAll<HTMLButtonElement>('[role^="menuitem"]:not(:disabled)')) : [];
}

export function Menu({
  items,
  ariaLabel = 'Options',
  triggerIcon = 'more',
  triggerVariant = 'ghost',
  triggerSize = 'md',
  triggerTitle,
  triggerLabel,
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
        iconOnly={!triggerLabel}
        iconLeft={triggerIcon}
        title={triggerTitle}
        aria-label={ariaLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {triggerLabel}
      </Button>
      {open && position && createPortal(
        <ul
          ref={menuRef}
          role="menu"
          className={styles.menu}
          style={{ top: position.top, left: position.left }}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={handleMenuKeyDown}
        >
          {items.map((item, idx) => {
            const isToggle = item.checked !== undefined;
            // Le menu va se démonter : le focus revient d'abord au déclencheur, pour qu'une
            // modale ouverte par l'action le mémorise comme élément à restaurer.
            const run = (onClick: () => void) => {
              triggerRef.current?.focus();
              onClick();
              close();
            };
            return (
              <li key={item.label} role="none" className={cx(styles.row, item.action && styles.rowSplit)}>
                {/* Un seul séparateur, avant la première action dangereuse. */}
                {item.variant === 'danger' && idx > 0 && items[idx - 1]?.variant !== 'danger' && (
                  <span className={styles.divider} aria-hidden="true" />
                )}
                <button
                  type="button"
                  role={isToggle ? 'menuitemcheckbox' : 'menuitem'}
                  aria-checked={isToggle ? item.checked : undefined}
                  tabIndex={-1}
                  disabled={item.disabled}
                  className={cx(styles.item, item.variant === 'danger' && styles.itemDanger)}
                  onClick={isToggle ? item.onClick : () => run(item.onClick)}
                >
                  {item.icon && <Icons className={styles.icon} icon={item.icon} size={16} />}
                  <span className={styles.label}>{item.label}</span>
                  {isToggle && <SwitchTrack checked={item.checked === true} />}
                </button>
                {item.action && (
                  <button
                    type="button"
                    role="menuitem"
                    tabIndex={-1}
                    aria-label={item.action.label}
                    title={item.action.label}
                    className={cx(styles.item, styles.actionItem)}
                    onClick={() => item.action && run(item.action.onClick)}
                  >
                    <Icons className={styles.icon} icon={item.action.icon} size={16} />
                  </button>
                )}
              </li>
            );
          })}
        </ul>,
        document.body,
      )}
    </div>
  );
}
