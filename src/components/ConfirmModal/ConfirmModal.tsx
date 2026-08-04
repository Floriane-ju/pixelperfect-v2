import { useId } from 'react';
import { Button } from '@/components/Button';
import { Dialog } from '@/components/Dialog';
import styles from './ConfirmModal.module.scss';

export interface ConfirmModalProps {
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
}: ConfirmModalProps) {
  const messageId = useId();

  return (
    <Dialog
      size="sm"
      ariaLabelledBy={messageId}
      onClose={onCancel}
      actions={
        <>
          <Button variant="ghost" size="sm" onClick={onCancel}>{cancelLabel}</Button>
          <Button variant="primary" size="sm" onClick={onConfirm}>{confirmLabel}</Button>
        </>
      }
    >
      <p id={messageId} className={styles.text}>{message}</p>
    </Dialog>
  );
}
