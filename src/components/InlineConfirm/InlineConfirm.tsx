import type { ReactNode } from 'react';
import { Button } from '@/components/Button';
import { cx } from '@/lib/cx';
import styles from './InlineConfirm.module.scss';

export type InlineConfirmLayout = 'row' | 'column';

export interface InlineConfirmProps {
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Désactive les deux boutons pendant l'action en cours. */
  busy?: boolean;
  layout?: InlineConfirmLayout;
  className?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Confirmation en place (sans modale) pour une action destructrice au sein d'une carte
 * ou d'une ligne de menu. Le clic est arrêté ici : la surface parente est cliquable.
 */
export function InlineConfirm({
  message,
  confirmLabel = 'Oui',
  cancelLabel = 'Non',
  busy = false,
  layout = 'row',
  className,
  onConfirm,
  onCancel,
}: InlineConfirmProps) {
  return (
    <div
      className={cx(styles.confirm, styles[`layout-${layout}`], className)}
      onClick={(e) => e.stopPropagation()}
    >
      <span className={styles.message}>{message}</span>
      <div className={styles.actions}>
        <Button variant="danger" size="sm" disabled={busy} onClick={onConfirm}>
          {confirmLabel}
        </Button>
        <Button variant="ghost" size="sm" disabled={busy} onClick={onCancel}>
          {cancelLabel}
        </Button>
      </div>
    </div>
  );
}
