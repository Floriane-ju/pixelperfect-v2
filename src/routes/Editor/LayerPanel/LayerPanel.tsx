import { useCallback, useRef, useState } from 'react';
import { Button } from '@/components/Button';
import { Icons } from '@/components/Icons';
import type { PixelLayer } from '@/types';
import { LayerThumbnail } from './LayerThumbnail';
import styles from './LayerPanel.module.scss';

interface LayerPanelProps {
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

interface DragState {
  id: string;
  targetId: string | null;
  pos: 'before' | 'after';
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

  const itemRefs = useRef<Map<string, HTMLLIElement>>(new Map());
  const [drag, setDrag] = useState<DragState | null>(null);
  const dragRef = useRef<DragState | null>(null);
  dragRef.current = drag;

  const setItemRef = useCallback((id: string) => (el: HTMLLIElement | null) => {
    if (el) itemRefs.current.set(id, el);
    else itemRefs.current.delete(id);
  }, []);

  const handleHandlePointerDown = (e: React.PointerEvent<HTMLSpanElement>, id: string) => {
    e.stopPropagation();
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    setDrag({ id, targetId: null, pos: 'before' });
  };

  const handleHandlePointerMove = (e: React.PointerEvent<HTMLSpanElement>) => {
    const current = dragRef.current;
    if (!current) return;
    const y = e.clientY;
    const entries = Array.from(itemRefs.current.entries());
    let targetId: string | null = null;
    let pos: 'before' | 'after' = 'before';
    for (const [id, el] of entries) {
      if (id === current.id) continue;
      const r = el.getBoundingClientRect();
      if (y >= r.top && y <= r.bottom) {
        targetId = id;
        pos = y < r.top + r.height / 2 ? 'before' : 'after';
        break;
      }
    }
    if (!targetId && entries.length > 0) {
      const first = entries[0];
      const last = entries[entries.length - 1];
      if (first && y < first[1].getBoundingClientRect().top) {
        targetId = first[0];
        pos = 'before';
      } else if (last && y > last[1].getBoundingClientRect().bottom) {
        targetId = last[0];
        pos = 'after';
      }
    }
    if (targetId !== current.targetId || pos !== current.pos) {
      setDrag({ id: current.id, targetId, pos });
    }
  };

  const handleHandlePointerUp = (e: React.PointerEvent<HTMLSpanElement>) => {
    const current = dragRef.current;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    setDrag(null);
    if (!current || !current.targetId || current.targetId === current.id) return;
    const realPos: 'before' | 'after' = current.pos === 'before' ? 'after' : 'before';
    onReorder(current.id, current.targetId, realPos);
  };

  return (
    <div className={styles.panel} role="dialog" aria-label="Calques">
      <div className={styles.header}>
        <h2 className={styles.title}>Calques</h2>
        <Button
          variant="ghost"
          size="md"
          iconOnly
          iconLeft="add"
          title="Nouveau calque"
          aria-label="Nouveau calque"
          onClick={onAdd}
        />
      </div>
      <ul className={styles.list} role="listbox">
        {reversed.map(layer => {
          const isActive = layer.id === activeLayerId;
          const isDragging = drag?.id === layer.id;
          const isDropBefore = drag?.targetId === layer.id && drag.pos === 'before';
          const isDropAfter = drag?.targetId === layer.id && drag.pos === 'after';
          const classes = [
            styles.item,
            isActive ? styles.itemActive : '',
            isDragging ? styles.itemDragging : '',
            isDropBefore ? styles.itemDropBefore : '',
            isDropAfter ? styles.itemDropAfter : '',
          ].filter(Boolean).join(' ');
          return (
            <li
              key={layer.id}
              ref={setItemRef(layer.id)}
              role="option"
              aria-selected={isActive}
              className={classes}
              onClick={() => onSelect(layer.id)}
            >
              <span
                className={styles.handle}
                aria-hidden="true"
                onPointerDown={e => handleHandlePointerDown(e, layer.id)}
                onPointerMove={handleHandlePointerMove}
                onPointerUp={handleHandlePointerUp}
                onPointerCancel={handleHandlePointerUp}
                onClick={e => e.stopPropagation()}
              >
                <Icons icon="drag" size={24} />
              </span>
              <Button
                variant={isActive ? 'ghost-accent-1' : 'ghost'}
                size="md"
                iconOnly
                iconLeft={layer.visible ? 'eye' : 'eye-off'}
                title={layer.visible ? 'Masquer' : 'Afficher'}
                aria-label={layer.visible ? 'Masquer le calque' : 'Afficher le calque'}
                onClick={e => { e.stopPropagation(); onVisibilityToggle(layer.id); }}
              />
              <LayerThumbnail layer={layer} width={canvasWidth} height={canvasHeight} size={40} />
              <span className={styles.layerName}>{layer.name}</span>
              <Button
                variant={isActive ? 'ghost-accent-1' : 'ghost'}
                size="md"
                iconOnly
                iconLeft="duplicate"
                title="Dupliquer"
                aria-label="Dupliquer le calque"
                onClick={e => { e.stopPropagation(); onDuplicate(layer.id); }}
              />
              <Button
                variant={isActive ? 'ghost-accent-1' : 'ghost'}
                size="md"
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
    </div>
  );
}
