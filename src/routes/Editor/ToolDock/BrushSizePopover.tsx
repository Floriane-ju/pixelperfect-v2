import { useId } from 'react';
import { BrushSizeSlider } from '@/components/BrushSizeSlider';
import { Icons } from '@/components/Icons';
import { BRUSH_MAX, BRUSH_MIN } from '../tools';
import styles from './ToolDock.module.scss';

export interface BrushSizePopoverProps {
  toolLabel: string;
  size: number;
  onSizeChange: (size: number) => void;
  onClose: () => void;
}

/** Popover de taille du pinceau, ouvert par appui long (ou clic droit) sur crayon / gomme. */
export function BrushSizePopover({ toolLabel, size, onSizeChange, onClose }: BrushSizePopoverProps) {
  const titleId = useId();
  return (
    <section className={styles.popover} role="dialog" aria-labelledby={titleId}>
      <header className={styles.popoverTitlebar}>
        <h2 id={titleId} className={styles.popoverTitle}>Pinceau · {toolLabel}</h2>
        <button type="button" className={styles.popoverClose} aria-label="Fermer" onClick={onClose}>
          <Icons icon="close" size={16} />
        </button>
      </header>
      <div className={styles.popoverBody}>
        <BrushSizeSlider value={size} min={BRUSH_MIN} max={BRUSH_MAX} onChange={onSizeChange} />
      </div>
      <footer className={styles.popoverFooter}>
        <span className={styles.footerMark} aria-hidden="true" />
        Appui long sur l’outil · Échap ferme
      </footer>
    </section>
  );
}
