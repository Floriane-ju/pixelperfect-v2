import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
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
}

export function ContextMenu({ items, onClose }: Props) {
  const ref = useRef<HTMLUListElement>(null);

  useEffect(() => {
    const handlePointer = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('pointerdown', handlePointer);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('pointerdown', handlePointer);
      document.removeEventListener('keydown', handleKey);
    };
  }, [onClose]);

  return (
    <ul role="menu" className={styles.menu} ref={ref}>
      {items.map((item, i) => (
        <li key={i} role="none">
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
