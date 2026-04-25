import { useEffect, useId, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import styles from './Dropdown.module.scss';

export interface DropdownOption<T extends string = string> {
  value: T;
  label: ReactNode;
  disabled?: boolean;
}

export interface DropdownProps<T extends string = string> {
  options: ReadonlyArray<DropdownOption<T>>;
  value: T;
  onChange: (value: T) => void;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function Dropdown<T extends string = string>({
  options,
  value,
  onChange,
  label,
  placeholder = 'Sélectionner',
  disabled = false,
  className,
}: DropdownProps<T>) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();

  useEffect(() => {
    if (!open) return;
    const handlePointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', handlePointer);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('pointerdown', handlePointer);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  const selected = options.find((o) => o.value === value);
  const classes = [styles.root, className ?? ''].filter(Boolean).join(' ');

  return (
    <div ref={rootRef} className={classes}>
      {label ? <span className={styles.label}>{label}</span> : null}
      <button
        type="button"
        className={styles.trigger}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
      >
        <span className={styles.value}>
          {selected ? selected.label : <span className={styles.placeholder}>{placeholder}</span>}
        </span>
        <span className={styles.chevron} aria-hidden>
          ▾
        </span>
      </button>

      {open ? (
        <ul id={listboxId} role="listbox" className={styles.menu}>
          {options.map((opt) => {
            const isSelected = opt.value === value;
            return (
              <li
                key={opt.value}
                role="option"
                aria-selected={isSelected}
                aria-disabled={opt.disabled}
                className={[
                  styles.option,
                  isSelected ? styles.selected : '',
                  opt.disabled ? styles.disabled : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => {
                  if (opt.disabled) return;
                  onChange(opt.value);
                  setOpen(false);
                }}
              >
                {opt.label}
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
