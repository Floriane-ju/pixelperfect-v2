import { useEffect, useRef } from 'react';
import type { ReactNode, RefObject } from 'react';
import styles from './ContextMenu.module.scss';

export interface ContextMenuItem {
  label: ReactNode;
  onClick: () => void;
  variant?: 'default' | 'danger';
  disabled?: boolean;
}

interface Props {
  items: ContextMenuItem[];
  onClose: () => void;
  triggerRef?: RefObject<HTMLElement>;
}

export function ContextMenu({ items, onClose, triggerRef }: Props) {
  const ref = useRef<HTMLUListElement>(null);

  useEffect(() => {
    const previouslyFocused = document.activeElement;
    const first = ref.current?.querySelector<HTMLButtonElement>('button:not([disabled])');
    first?.focus();
    return () => {
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus();
    };
  }, []);

  useEffect(() => {
    const handlePointer = (e: PointerEvent) => {
      const target = e.target as Node;
      if (ref.current?.contains(target)) return;
      if (triggerRef?.current?.contains(target)) return;
      onClose();
    };
    const handleKey = (e: KeyboardEvent) => {
      const menu = ref.current;
      if (!menu) return;
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'Home' && e.key !== 'End') return;
      const buttons = Array.from(menu.querySelectorAll<HTMLButtonElement>('button:not([disabled])'));
      if (buttons.length === 0) return;
      const idx = buttons.indexOf(document.activeElement as HTMLButtonElement);
      e.preventDefault();
      if (e.key === 'Home') { buttons[0]?.focus(); return; }
      if (e.key === 'End') { buttons[buttons.length - 1]?.focus(); return; }
      const delta = e.key === 'ArrowDown' ? 1 : -1;
      const next = idx === -1 ? 0 : (idx + delta + buttons.length) % buttons.length;
      buttons[next]?.focus();
    };
    document.addEventListener('pointerdown', handlePointer);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('pointerdown', handlePointer);
      document.removeEventListener('keydown', handleKey);
    };
  }, [onClose, triggerRef]);

  return (
    <ul role="menu" aria-orientation="vertical" className={styles.menu} ref={ref}>
      {items.map((item) => (
        <li key={String(item.label)} role="none">
          <button
            type="button"
            role="menuitem"
            disabled={item.disabled}
            className={[
              styles.item,
              item.variant === 'danger' ? styles.danger : '',
            ]
              .filter(Boolean)
              .join(' ')}
            onClick={(e) => {
              e.stopPropagation();
              item.onClick();
              onClose();
            }}
          >
            {item.label}
          </button>
        </li>
      ))}
    </ul>
  );
}
