import { Button } from '@/components/Button';
import styles from './GalleryStates.module.scss';

const SKELETON_COUNT = 3;
const PROGRESS_PIXELS = 6;

/** Pictogramme « ! » 5 × 7 en pixels (1 = encre rouge). */
const BANG = ['01110', '01110', '01110', '00100', '00100', '00000', '00100'];

export function GalleryLoading() {
  return (
    <div className={styles.loading} role="status" aria-live="polite">
      <div className={styles.loadingTitle}>
        <span className={styles.title}>Chargement…</span>
        <span className={styles.progress} aria-hidden="true">
          {Array.from({ length: PROGRESS_PIXELS }, (_, i) => (
            <span key={i} className={styles.progressPixel} />
          ))}
        </span>
      </div>
      <div className={styles.skeletons} aria-hidden="true">
        {Array.from({ length: SKELETON_COUNT }, (_, i) => (
          <div key={i} className={styles.skeleton}>
            <div className={styles.skeletonHead}>
              <span className={styles.skeletonNum} />
              <span className={styles.skeletonMeta} />
            </div>
            <span className={styles.skeletonArt} />
            <span className={styles.skeletonName} />
          </div>
        ))}
      </div>
    </div>
  );
}

export interface GalleryEmptyProps {
  onCreate: () => void;
}

export function GalleryEmpty({ onCreate }: GalleryEmptyProps) {
  return (
    <div className={styles.center}>
      <span className={styles.emptyCanvas} aria-hidden="true">
        <span className={styles.emptyPixel} />
      </span>
      <p className={styles.message}>Aucun dessin pour le moment.</p>
      <Button variant="primary" iconLeft="add" aria-haspopup="dialog" onClick={onCreate}>
        Nouveau dessin
      </Button>
    </div>
  );
}

export interface GalleryErrorProps {
  message: string;
  onRetry: () => void;
}

export function GalleryError({ message, onRetry }: GalleryErrorProps) {
  return (
    <div className={styles.center} role="alert">
      <span className={styles.bang} aria-hidden="true">
        {BANG.flatMap((row, y) =>
          [...row].map((cell, x) => (
            <span key={`${x}-${y}`} className={cell === '1' ? styles.bangOn : undefined} />
          ))
        )}
      </span>
      <div className={styles.errorText}>
        <p className={styles.message}>Erreur de chargement.</p>
        {message && <p className={styles.detail}>{message}</p>}
      </div>
      <Button variant="secondary" onClick={onRetry}>
        Réessayer
      </Button>
    </div>
  );
}
