import type { PixelLayer } from '@/types';
import styles from './LayerPanel.module.scss';

interface LayerPanelProps {
  layers: PixelLayer[];
  activeLayerId: string;
  onSelect: (id: string) => void;
  onVisibilityToggle: (id: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onAdd: () => void;
}

export function LayerPanel({
  layers,
  activeLayerId,
  onSelect,
  onVisibilityToggle,
  onDuplicate,
  onDelete,
  onAdd,
}: LayerPanelProps) {
  const reversed = [...layers].reverse();
  const canDelete = layers.length > 1;

  return (
    <div className={styles.panel} role="dialog" aria-label="Calques">
      <div className={styles.header}>
        <span className={styles.title}>Calques</span>
        <button
          className={styles.addBtn}
          title="Nouveau calque"
          aria-label="Nouveau calque"
          onClick={onAdd}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
      </div>
      <ul className={styles.list} role="listbox">
        {reversed.map(layer => (
          <li
            key={layer.id}
            role="option"
            aria-selected={layer.id === activeLayerId}
            className={`${styles.item} ${layer.id === activeLayerId ? styles.itemActive : ''}`}
            onClick={() => onSelect(layer.id)}
          >
            <button
              className={styles.iconBtn}
              title={layer.visible ? 'Masquer' : 'Afficher'}
              aria-label={layer.visible ? 'Masquer le calque' : 'Afficher le calque'}
              onClick={e => { e.stopPropagation(); onVisibilityToggle(layer.id); }}
            >
              {layer.visible ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                  <line x1="1" y1="1" x2="23" y2="23" />
                </svg>
              )}
            </button>
            <span className={styles.layerName}>{layer.name}</span>
            <button
              className={styles.iconBtn}
              title="Dupliquer"
              aria-label="Dupliquer le calque"
              onClick={e => { e.stopPropagation(); onDuplicate(layer.id); }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
            </button>
            <button
              className={`${styles.iconBtn} ${styles.iconBtnDanger}`}
              title="Supprimer"
              aria-label="Supprimer le calque"
              disabled={!canDelete}
              onClick={e => { e.stopPropagation(); if (canDelete) onDelete(layer.id); }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                <path d="M10 11v6M14 11v6" />
                <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
              </svg>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
