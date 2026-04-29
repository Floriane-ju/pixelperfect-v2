import { useRef, useState } from 'react';
import type { PointerEvent } from 'react';
import { DrawingCard } from '@/components/DrawingCard';
import type { DrawingRow } from '@/types';
import styles from './GroupModal.module.scss';

interface Props {
  name: string;
  drawings: DrawingRow[];
  onClose: () => void;
  onCardClick: (id: string) => void;
  onRename?: (id: string, title: string) => void;
  onDelete?: (id: string) => void;
  onRemoveFromGroup?: (id: string) => void;
}

export function GroupModal({
  name,
  drawings,
  onClose,
  onCardClick,
  onRename,
  onDelete,
  onRemoveFromGroup,
}: Props) {
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const drag = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null);

  const onDragStart = (e: PointerEvent<HTMLElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { sx: e.clientX, sy: e.clientY, ox: offset.x, oy: offset.y };
  };

  const onDragMove = (e: PointerEvent<HTMLElement>) => {
    if (!drag.current) return;
    setOffset({
      x: drag.current.ox + e.clientX - drag.current.sx,
      y: drag.current.oy + e.clientY - drag.current.sy,
    });
  };

  const onDragEnd = () => {
    drag.current = null;
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div
        className={styles.panel}
        style={{ transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))` }}
        onClick={(e) => e.stopPropagation()}
      >
        <header
          className={styles.header}
          onPointerDown={onDragStart}
          onPointerMove={onDragMove}
          onPointerUp={onDragEnd}
        >
          <div className="deco thin" aria-hidden="true">
            <div/>
            <div/>
            <div/>
          </div>
          <h2 className={styles.title}>{name}</h2>
          <div className="deco" aria-hidden="true">
            <div/>
            <div/>
            <div/>
          </div>
          <button
            type="button"
            className={styles.closeBtn}
            aria-label="Fermer"
            onClick={(e) => { e.stopPropagation(); onClose(); }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            ×
          </button>
        </header>
        <div className={styles.content}>
          {drawings.map((d) => (
            <DrawingCard
              key={d.id}
              drawing={d}
              onClick={() => onCardClick(d.id)}
              onRename={onRename ? (title) => onRename(d.id, title) : undefined}
              onDelete={onDelete ? () => onDelete(d.id) : undefined}
              onRemoveFromGroup={onRemoveFromGroup ? () => onRemoveFromGroup(d.id) : undefined}
            />
          ))}
          {drawings.length === 0 && (
            <p className={styles.empty}>Aucun dessin dans ce groupe.</p>
          )}
        </div>
      </div>
    </div>
  );
}
