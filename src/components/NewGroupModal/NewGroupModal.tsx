import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/Button';
import styles from './NewGroupModal.module.scss';

interface Props {
  onClose: () => void;
  onConfirm: (groupName: string) => void;
}

export function NewGroupModal({ onClose, onConfirm }: Props) {
  const [name, setName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const handleSubmit = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onConfirm(trimmed);
  };

  return (
    <div className={styles.overlay} onPointerDown={onClose}>
      <div
        className={styles.modal}
        onPointerDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-group-title"
      >
        <h2 id="new-group-title" className={styles.heading}>
          Nouveau groupe
        </h2>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="group-name">
            Nom du groupe
          </label>
          <input
            ref={inputRef}
            id="group-name"
            className={styles.input}
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={80}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(); }}
          />
        </div>

        <div className={styles.actions}>
          <Button variant="secondary" size="sm" onClick={onClose}>
            Annuler
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleSubmit}
            disabled={!name.trim()}
          >
            Créer
          </Button>
        </div>
      </div>
    </div>
  );
}
