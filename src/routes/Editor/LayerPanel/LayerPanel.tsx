import { Icons } from '@/components/Icons';
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
          <Icons icon="add" size={14} />
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
                <Icons icon="eye" size={16} />
              ) : (
                <Icons icon="eye-off" size={16} />
              )}
            </button>
            <span className={styles.layerName}>{layer.name}</span>
            <button
              className={styles.iconBtn}
              title="Dupliquer"
              aria-label="Dupliquer le calque"
              onClick={e => { e.stopPropagation(); onDuplicate(layer.id); }}
            >
              <Icons icon="duplicate" size={14} />
            </button>
            <button
              className={`${styles.iconBtn} ${styles.iconBtnDanger}`}
              title="Supprimer"
              aria-label="Supprimer le calque"
              disabled={!canDelete}
              onClick={e => { e.stopPropagation(); if (canDelete) onDelete(layer.id); }}
            >
              <Icons icon="trash" size={14} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
