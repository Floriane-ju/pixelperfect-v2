import { DrawingThumbnail } from '@/components/DrawingThumbnail';
import type { DrawingRow } from '@/types';
import styles from './GroupCard.module.scss';

interface Props {
  name: string;
  drawings: DrawingRow[];
  onOpen: () => void;
}

const MAX_PREVIEWS = 4;

export function GroupCard({ name, drawings, onOpen }: Props) {
  const previews = drawings.slice(0, MAX_PREVIEWS);

  return (
    <article
      className={styles.card}
      onClick={onOpen}
      role="button"
      tabIndex={0}
      aria-label={`Groupe ${name}`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen();
        }
      }}
    >
      <header className={styles.info}>
        <div className={styles.meta}>
          <span className={styles.metaLabel}>Illus</span>
          <span className={styles.metaValue}>{drawings.length}</span>
        </div>
        <span className={styles.title}>{name}</span>
      </header>

      <div className={styles.preview}>
        <div className={styles.thumbGrid}>
          {previews.map((d) => (
            <div key={d.id} className={styles.thumb}>
              <DrawingThumbnail data={d.data} size={48} />
            </div>
          ))}
        </div>
      </div>
    </article>
  );
}
