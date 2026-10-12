import { useCallback, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { Button } from '@/components/Button';
import { Icons } from '@/components/Icons';
import { cx } from '@/lib/cx';
import { MAX_LAYERS } from '@/lib/drawingValidation';
import type { PixelLayer } from '@/types';
import { useDragReorder } from '@/routes/Editor/hooks/useDragReorder';
import { LayerThumbnail } from './LayerThumbnail';
import styles from './LayerPanel.module.scss';

export interface LayerPanelProps {
  layers: PixelLayer[];
  activeLayerId: string;
  canvasWidth: number;
  canvasHeight: number;
  onSelect: (id: string) => void;
  onVisibilityToggle: (id: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onAdd: () => void;
  onReorder: (fromId: string, toId: string, position: 'before' | 'after') => void;
}

export function LayerPanel({
  layers,
  activeLayerId,
  canvasWidth,
  canvasHeight,
  onSelect,
  onVisibilityToggle,
  onDuplicate,
  onDelete,
  onAdd,
  onReorder,
}: LayerPanelProps) {
  const reversed = [...layers].reverse();
  const canDelete = layers.length > 1;
  const atLayerCap = layers.length >= MAX_LAYERS;

  const { drag, itemRefs, setItemRef, handleProps } = useDragReorder<HTMLLIElement>({
    axis: 'y',
    // Affichage inversé (dessus en premier) : « avant » à l'écran = « après » dans `layers`.
    onDrop: (fromId, toId, pos) => onReorder(fromId, toId, pos === 'before' ? 'after' : 'before'),
  });
  const [announcement, setAnnouncement] = useState<string>('');

  /**
   * `reversed` est l'ordre d'affichage : l'index 0 est le calque du dessus. Les positions
   * annoncées suivent donc cet ordre-là, celui que la personne voit, et non l'ordre interne
   * de `layers` qui est inversé.
   *
   * Flèches seules : déplacent la sélection, c'est la navigation attendue d'un `listbox`
   * (sans elles, seul le calque déjà actif serait focalisable, donc lui seul déplaçable).
   * Alt + flèches : réordonnent. `Alt` est exigé pour ne pas confisquer les flèches simples.
   */
  const handleLayerKeyDown = useCallback(
    (e: KeyboardEvent<HTMLLIElement>, layer: PixelLayer, index: number) => {
      if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;

      const delta = e.key === 'ArrowUp' ? -1 : 1;
      const targetIndex = index + delta;
      const target = reversed[targetIndex];
      if (!target) return;

      e.preventDefault();

      if (e.altKey) {
        onReorder(layer.id, target.id, delta === -1 ? 'after' : 'before');
        setAnnouncement(`${layer.name} déplacé en position ${targetIndex + 1} sur ${layers.length}`);
        // Le calque suit son déplacement : on garde le focus dessus.
        requestAnimationFrame(() => itemRefs.current.get(layer.id)?.focus());
        return;
      }

      onSelect(target.id);
      itemRefs.current.get(target.id)?.focus();
    },
    [reversed, layers.length, onReorder, onSelect, itemRefs]
  );

  return (
    <div className={styles.panel} role="group" aria-labelledby="layer-panel-title">
      <div className={styles.header}>
        <h2 className={styles.title} id="layer-panel-title">Calques</h2>
        <span className={styles.count}>{layers.length}</span>
        <Button
          variant="ghost"
          size="md"
          iconOnly
          iconLeft="add"
          title="Nouveau calque"
          aria-label="Nouveau calque"
          onClick={onAdd}
          disabled={atLayerCap}
        />
      </div>
      <ul className={styles.list} role="listbox">
        {reversed.map((layer, index) => {
          const isActive = layer.id === activeLayerId;
          const isDragging = drag?.id === layer.id;
          const isDropBefore = drag?.targetId === layer.id && drag.pos === 'before';
          const isDropAfter = drag?.targetId === layer.id && drag.pos === 'after';
          const classes = cx(
            styles.item,
            isActive && styles.itemActive,
            isDragging && styles.itemDragging,
            isDropBefore && styles.itemDropBefore,
            isDropAfter && styles.itemDropAfter,
          );
          return (
            <li
              key={layer.id}
              ref={setItemRef(layer.id)}
              role="option"
              aria-selected={isActive}
              className={classes}
              tabIndex={isActive ? 0 : -1}
              onClick={() => onSelect(layer.id)}
              onKeyDown={(e) => handleLayerKeyDown(e, layer, index)}
            >
              <span
                className={styles.handle}
                aria-hidden="true"
                {...handleProps(layer.id)}
              >
                <Icons icon="drag" size={16} />
              </span>
              <Button
                variant="ghost"
                size="sm"
                iconOnly
                iconLeft={layer.visible ? 'eye' : 'eye-off'}
                title={layer.visible ? 'Masquer' : 'Afficher'}
                aria-label={layer.visible ? 'Masquer le calque' : 'Afficher le calque'}
                onClick={e => { e.stopPropagation(); onVisibilityToggle(layer.id); }}
              />
              <LayerThumbnail layer={layer} width={canvasWidth} height={canvasHeight} size={40} />
              <span className={styles.layerName}>{layer.name}</span>
              <Button
                variant="ghost"
                size="sm"
                iconOnly
                iconLeft="duplicate"
                title="Dupliquer"
                aria-label="Dupliquer le calque"
                onClick={e => { e.stopPropagation(); onDuplicate(layer.id); }}
                disabled={atLayerCap}
              />
              <Button
                variant="ghost"
                size="sm"
                iconOnly
                iconLeft="trash"
                title="Supprimer"
                aria-label="Supprimer le calque"
                disabled={!canDelete}
                onClick={e => { e.stopPropagation(); if (canDelete) onDelete(layer.id); }}
              />
            </li>
          );
        })}
      </ul>
      <div aria-live="polite" aria-atomic="true" className={styles.liveRegion}>
        {announcement}
      </div>
    </div>
  );
}
