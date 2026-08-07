import type { PointerEvent, ReactNode } from 'react';
import { Button } from '@/components/Button';
import { cx } from '@/lib/cx';
import styles from './ModalHeader.module.scss';

export type ModalHeaderTone = 'accent-1' | 'accent-2';

export interface ModalHeaderProps {
  title: ReactNode;
  titleId: string;
  onClose: () => void;
  tone?: ModalHeaderTone;
  /** Actions optionnelles affichées à gauche du bouton de fermeture. */
  actions?: ReactNode;
  /** Handlers de glissement fournis par `useDraggableModal`. */
  dragHandlers: {
    onPointerDown: (e: PointerEvent<HTMLElement>) => void;
    onPointerMove: (e: PointerEvent<HTMLElement>) => void;
    onPointerUp: () => void;
  };
}

/** En-tête d'une modale flottante : poignée de glissement, titre décoré et bouton de fermeture. */
export function ModalHeader({
  title,
  titleId,
  onClose,
  tone = 'accent-1',
  actions,
  dragHandlers,
}: ModalHeaderProps) {
  return (
    <header className={styles.header} {...dragHandlers}>
      <div className="deco thin" aria-hidden="true">
        <div />
        <div />
        <div />
      </div>
      <h2 id={titleId} className={cx(styles.title, styles[`tone-${tone}`])}>
        {title}
      </h2>
      <div className="deco" aria-hidden="true">
        <div />
        <div />
        <div />
      </div>
      {actions}
      <Button
        variant="primary"
        iconOnly
        iconLeft="close"
        aria-label="Fermer"
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        onPointerDown={(e) => e.stopPropagation()}
      />
    </header>
  );
}
