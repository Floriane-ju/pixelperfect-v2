import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button, type ButtonSize, type ButtonVariant } from '@/components/Button';
import { Icons, type IconName } from '@/components/Icons';
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

interface Position {
  top: number;
  left: number;
}

const MENU_GAP = 4;

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

  const [position, setPosition] = useState<Position | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);

  const updatePosition = useCallback(() => {
    const root = rootRef.current;
    const menu = menuRef.current;
    if (!root) return;
    const rect = root.getBoundingClientRect();
    const menuWidth = menu?.offsetWidth ?? 220;
    const left = Math.max(MENU_GAP, Math.min(rect.right - menuWidth, window.innerWidth - menuWidth - MENU_GAP));
    setPosition({ top: rect.bottom + MENU_GAP, left });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return;
    const handlePointer = (e: PointerEvent) => {
      const target = e.target as Node;
      if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const handleReposition = () => updatePosition();
    document.addEventListener('pointerdown', handlePointer);
    document.addEventListener('keydown', handleKey);
    window.addEventListener('resize', handleReposition);
    window.addEventListener('scroll', handleReposition, true);
    return () => {
      document.removeEventListener('pointerdown', handlePointer);
      document.removeEventListener('keydown', handleKey);
      window.removeEventListener('resize', handleReposition);
      window.removeEventListener('scroll', handleReposition, true);
    };
  }, [open, setOpen, updatePosition]);

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
                className={[
                  styles.item,
                  item.variant === 'danger' ? styles.itemDanger : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => {
                  item.onClick();
                  setOpen(false);
                }}
              >
                {item.icon && (
                  <Icons className={styles.icon} icon={item.icon} size={24} />
                )}
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
