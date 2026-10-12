import type { ReactNode } from 'react';
import type { UseDraggableModalReturn } from '@/hooks/useDraggableModal';
import { Icons } from '@/components/Icons';
import styles from './ModalHeader.module.scss';

export interface ModalHeaderProps {
  title: ReactNode;
  titleId: string;
  onClose: () => void;
  /** Actions optionnelles affichées à gauche du bouton de fermeture. */
  actions?: ReactNode;
  /** Handlers de glissement fournis par `useDraggableModal`. */
  dragHandlers: UseDraggableModalReturn['dragHandlers'];
}

/** Barre de titre encre d'une modale flottante : poignée de glissement, titre et fermeture. */
export function ModalHeader({
  title,
  titleId,
  onClose,
  actions,
  dragHandlers,
}: ModalHeaderProps) {
  return (
    <header className={styles.header} {...dragHandlers}>
      <h2 id={titleId} className={styles.title}>
        {title}
      </h2>
      {actions ? <div className={styles.actions}>{actions}</div> : null}
      <button
        type="button"
        className={styles.close}
        aria-label="Fermer"
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <Icons icon="close" size={16} />
      </button>
    </header>
  );
}
