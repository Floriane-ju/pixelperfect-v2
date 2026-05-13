import { useId, useRef } from 'react';
import { Button } from '@/components/Button';
import { useModalA11y } from '@/hooks/useModalA11y';
import styles from './ConfirmModal.module.scss';

interface Props {
  message: string;
  cancelLabel?: string;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ConfirmModal({
  message,
  cancelLabel = 'Annuler',
  confirmLabel,
  onCancel,
  onConfirm,
}: Props) {
  const modalRef = useRef<HTMLDivElement>(null);
  const textId = useId();
  useModalA11y({ modalRef, onClose: onCancel });

  return (
    <div className={styles.overlay} onClick={onCancel}>
      <div
        ref={modalRef}
        className={styles.modal}
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={textId}
      >
        <p id={textId} className={styles.text}>{message}</p>
        <div className={styles.actions}>
          <Button variant="secondary" size="sm" onClick={onCancel}>{cancelLabel}</Button>
          <Button variant="primary" size="sm" onClick={onConfirm}>{confirmLabel}</Button>
        </div>
      </div>
    </div>
  );
}
