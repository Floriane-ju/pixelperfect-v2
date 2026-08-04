import { useId, useRef } from 'react';
import type { ReactNode, RefObject } from 'react';
import { useModalA11y } from '@/hooks/useModalA11y';
import { useModalZIndex } from '@/lib/modalStack';
import { cx } from '@/lib/cx';
import styles from './Dialog.module.scss';

export type DialogSize = 'sm' | 'md';

export interface DialogProps {
  /** Titre rendu en en-tête ; sert de nom accessible du dialogue. */
  title?: ReactNode;
  /** Nom accessible alternatif quand le dialogue n'a pas de titre visible. */
  ariaLabelledBy?: string;
  size?: DialogSize;
  onClose: () => void;
  initialFocusRef?: RefObject<HTMLElement | null>;
  /** Barre de boutons alignée à droite en bas du dialogue. */
  actions?: ReactNode;
  children?: ReactNode;
}

/**
 * Dialogue centré modal : voile sombre, fermeture au clic extérieur, piège de focus et
 * empilement. Pour une modale déplaçable avec en-tête décoré, voir `components/Modal`.
 */
export function Dialog({
  title,
  ariaLabelledBy,
  size = 'md',
  onClose,
  initialFocusRef,
  actions,
  children,
}: DialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const { zIndex, raise } = useModalZIndex();

  useModalA11y({ modalRef: dialogRef, onClose, initialFocusRef });

  return (
    <div className={styles.overlay} style={{ zIndex }} onPointerDown={onClose}>
      <div
        ref={dialogRef}
        className={cx(styles.dialog, styles[`size-${size}`])}
        onPointerDown={(e) => e.stopPropagation()}
        onPointerDownCapture={raise}
        onFocusCapture={raise}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : ariaLabelledBy}
      >
        {title ? (
          <h2 id={titleId} className={styles.heading}>
            {title}
          </h2>
        ) : null}
        {children}
        {actions ? <div className={styles.actions}>{actions}</div> : null}
      </div>
    </div>
  );
}
