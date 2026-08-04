import { useId, useRef } from 'react';
import type { ReactNode, RefObject } from 'react';
import { useModalA11y } from '@/hooks/useModalA11y';
import { useDraggableModal } from '@/hooks/useDraggableModal';
import { ModalHeader } from './ModalHeader';
import styles from './Modal.module.scss';

export interface ModalProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  initialFocusRef?: RefObject<HTMLElement | null>;
}

/**
 * Modale flottante déplaçable par son en-tête. Pour un dialogue centré simple
 * (voile + fermeture au clic extérieur), voir `components/Dialog`.
 */
export function Modal({ title, onClose, children, initialFocusRef }: ModalProps) {
  const { zIndex, panelStyle, raiseHandlers, dragHandlers } = useDraggableModal();
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useModalA11y({ modalRef: panelRef, onClose, initialFocusRef });

  return (
    <div className={styles.overlay} style={{ zIndex }}>
      <div
        ref={panelRef}
        className={styles.panel}
        style={panelStyle}
        {...raiseHandlers}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <ModalHeader
          title={title}
          titleId={titleId}
          onClose={onClose}
          dragHandlers={dragHandlers}
        />
        <div className={styles.content}>
          {children}
        </div>
      </div>
    </div>
  );
}
