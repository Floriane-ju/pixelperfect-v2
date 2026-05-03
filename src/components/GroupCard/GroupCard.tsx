import { useState } from 'react';
import { DrawingThumbnail } from '@/components/DrawingThumbnail';
import { Icons } from '@/components/Icons';
import type { DrawingRow } from '@/types';
import styles from './GroupCard.module.scss';

interface Props {
  name: string;
  drawings: DrawingRow[];
  onOpen: () => void;
  onDropDrawing?: (drawingId: string) => void;
}

const MAX_PREVIEWS = 5;
// 46 = $thumb-size (54) − 2×$border-width (2px outer) − 2×$border-width (2px inner)
const THUMB_RENDER_SIZE = 46;

export function GroupCard({ name, drawings, onOpen, onDropDrawing }: Props) {
  const [isDragOver, setIsDragOver] = useState(false);
  const previews = drawings.slice(0, MAX_PREVIEWS);

  return (
    <article
      className={`${styles.card}${isDragOver ? ` ${styles.dropTarget}` : ''}`}
      onClick={onOpen}
      role="button"
      tabIndex={0}
      aria-label={`Groupe ${name}`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(); }
      }}
      onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragOver(false);
        const drawingId = e.dataTransfer.getData('text/plain');
        if (drawingId) onDropDrawing?.(drawingId);
      }}
    >
      <header className={styles.header}>
        <span className={styles.title}>{name}</span>
        <span className={styles.icon} aria-hidden="true">
          <Icons icon="more" size={16} />
        </span>
      </header>

      <div className={styles.preview}>
        <div className={styles.previewContent}>
          <div className={styles.grid}>
            {previews.map((d) => (
              <div key={d.id} className={styles.thumb}>
                <div className={styles.thumbInner}>
                  <DrawingThumbnail data={d.data} size={THUMB_RENDER_SIZE} />
                </div>
              </div>
            ))}
            <div className={styles.thumbEmpty} aria-hidden="true" />
          </div>
        </div>
      </div>
    </article>
  );
}
