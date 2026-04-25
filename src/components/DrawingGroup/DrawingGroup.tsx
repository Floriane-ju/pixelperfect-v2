import { useState } from 'react';
import { DrawingCard } from '@/components/DrawingCard';
import type { DrawingRow } from '@/types';
import styles from './DrawingGroup.module.scss';

interface CardCallbacks {
  onRename?: (id: string, newTitle: string) => void;
  onDelete?: (id: string) => void;
  onRemoveFromGroup?: (id: string) => void;
}

interface Props extends CardCallbacks {
  name: string;
  drawings: DrawingRow[];
  onCardClick?: (id: string) => void;
}

export function DrawingGroup({
  name,
  drawings,
  onCardClick,
  onRename,
  onDelete,
  onRemoveFromGroup,
}: Props) {
  const [open, setOpen] = useState(true);

  return (
    <section className={styles.group}>
      <button
        type="button"
        className={styles.header}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className={styles.chevron} data-open={open}>▶</span>
        <span className={styles.name}>{name}</span>
        <span className={styles.count}>{drawings.length}</span>
      </button>

      {open && (
        <div className={styles.grid}>
          {drawings.map((d) => (
            <DrawingCard
              key={d.id}
              drawing={d}
              onClick={() => onCardClick?.(d.id)}
              onRename={onRename ? (title) => onRename(d.id, title) : undefined}
              onDelete={onDelete ? () => onDelete(d.id) : undefined}
              onRemoveFromGroup={onRemoveFromGroup ? () => onRemoveFromGroup(d.id) : undefined}
            />
          ))}
        </div>
      )}
    </section>
  );
}
