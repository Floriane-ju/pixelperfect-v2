import { useNavigate } from 'react-router';
import { Button } from '@/components/Button';
import styles from './Editor.module.scss';

export function EditorLoading() {
  return (
    <main className={styles.editor}>
      <div className={styles.centered}>
        <span className={styles.muted} role="status" aria-live="polite">Chargement…</span>
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
        <Button variant="ghost" size="sm" iconLeft="back" onClick={() => navigate('/')}>
          Retour à la galerie
        </Button>
      </div>
    </main>
  );
}
