import { useRef, useState } from 'react';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { useModalA11y } from '@/hooks/useModalA11y';
import styles from './NewGroupModal.module.scss';

interface Props {
  onClose: () => void;
  onConfirm: (groupName: string) => void;
}

export function NewGroupModal({ onClose, onConfirm }: Props) {
  const [name, setName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  useModalA11y({ modalRef, onClose, initialFocusRef: inputRef });

  const handleSubmit = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onConfirm(trimmed);
  };

  return (
    <div className={styles.overlay} onPointerDown={onClose}>
      <div
        ref={modalRef}
        className={styles.modal}
        onPointerDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-group-title"
      >
        <h2 id="new-group-title" className={styles.heading}>
          Nouveau groupe
        </h2>

        <Input
          ref={inputRef}
          id="group-name"
          label="Nom du groupe"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={80}
          onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(); }}
        />

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
