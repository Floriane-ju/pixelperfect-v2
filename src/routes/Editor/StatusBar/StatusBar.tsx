import { cx } from '@/lib/cx';
import type { EditorStatus } from '../hooks/useEditorDrawing';
import styles from './StatusBar.module.scss';

export interface StatusBarProps {
  toolLabel: string;
  /** Taille du pinceau, affichée seulement pour les outils qui l'utilisent. */
  brushSize?: number;
  layerName: string;
  mirror: string;
  width: number;
  height: number;
  status: EditorStatus;
}

const SAVE_LABELS: Partial<Record<EditorStatus, string>> = {
  saving: 'Enregistrement…',
  error: 'Non enregistré',
};

/** Barre d'état du bas : outil, calque, symétrie, dimensions et état de l'enregistrement. */
export function StatusBar({ toolLabel, brushSize, layerName, mirror, width, height, status }: StatusBarProps) {
  const saveLabel = SAVE_LABELS[status] ?? 'Enregistré';
  return (
    <footer className={styles.bar}>
      <span className={styles.tool}>
        {brushSize !== undefined ? `${toolLabel} · ${brushSize} px` : toolLabel}
      </span>
      <span className={styles.meta}>Calque : {layerName}</span>
      <span className={styles.meta}>Symétrie : {mirror}</span>
      <span className={styles.meta}>{width} × {height}</span>
      <span
        className={cx(styles.save, status === 'error' && styles.saveError)}
        role="status"
        aria-live="polite"
      >
        <span className={styles.saveMark} aria-hidden="true" />
        {saveLabel}
      </span>
    </footer>
  );
}
