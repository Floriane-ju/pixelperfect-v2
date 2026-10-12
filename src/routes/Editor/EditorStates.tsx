import { useNavigate } from 'react-router';
import { Button } from '@/components/Button';
import styles from './Editor.module.scss';

const LOADING_PIXELS = [0, 1, 2, 3, 4, 5];

export function EditorLoading() {
  return (
    <main className={styles.editor}>
      <div className={styles.centered}>
        <div role="status" aria-live="polite" className={styles.centered}>
          <span className={styles.loadingLabel}>Chargement…</span>
          <span className={styles.loadingBar} aria-hidden="true">
            {LOADING_PIXELS.map((i) => <span key={i} className={styles.loadingPixel} />)}
          </span>
        </div>
      </div>
    </main>
  );
}

export function EditorError() {
  const navigate = useNavigate();
  return (
    <main className={styles.editor}>
      <div className={styles.centered}>
        <span className={styles.danger} role="alert">Impossible de charger le dessin.</span>
        <Button variant="secondary" iconLeft="back" onClick={() => navigate('/')}>
          Retour à la galerie
        </Button>
      </div>
    </main>
  );
}
