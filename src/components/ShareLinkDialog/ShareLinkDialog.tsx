import { useEffect, useId, useState } from 'react';
import { Button } from '@/components/Button';
import { Dialog } from '@/components/Dialog';
import { Input } from '@/components/Input';
import { Switch } from '@/components/Switch';
import { fetchShareToken, publicUrl, setPublicLink } from '@/lib/publicLinks';
import styles from './ShareLinkDialog.module.scss';

export interface ShareLinkDialogProps {
  drawingId: string;
  title: string;
  onClose: () => void;
}

const COPIED_FEEDBACK_MS = 2000;

type State =
  | { status: 'loading' }
  | { status: 'ready'; token: string | null; pending: boolean; error: string | null };

/** Active, désactive et copie le lien public en lecture seule d'un dessin (propriétaire). */
export function ShareLinkDialog({ drawingId, title, onClose }: ShareLinkDialogProps) {
  const [state, setState] = useState<State>({ status: 'loading' });
  const [copied, setCopied] = useState(false);
  const labelId = useId();

  useEffect(() => {
    let cancelled = false;
    fetchShareToken(drawingId).then(
      (token) => { if (!cancelled) setState({ status: 'ready', token, pending: false, error: null }); },
      () => { if (!cancelled) setState({ status: 'ready', token: null, pending: false, error: 'Impossible de lire l’état du lien.' }); },
    );
    return () => { cancelled = true; };
  }, [drawingId]);

  const toggle = async (enabled: boolean) => {
    if (state.status !== 'ready') return;
    setState({ ...state, pending: true, error: null });
    try {
      const token = await setPublicLink(drawingId, enabled);
      setState({ status: 'ready', token, pending: false, error: null });
    } catch (err) {
      setState({ ...state, pending: false, error: err instanceof Error ? err.message : 'Erreur inconnue.' });
    }
  };

  const url = state.status === 'ready' && state.token ? publicUrl(state.token) : null;

  const copy = () => {
    if (!url) return;
    // Appel synchrone (geste utilisateur exigé par iOS) ; sans presse-papier, l'appel lève.
    let pending: Promise<void>;
    try {
      pending = navigator.clipboard.writeText(url);
    } catch (err) {
      pending = Promise.reject(err);
    }
    pending.then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), COPIED_FEEDBACK_MS);
      },
      () => { if (state.status === 'ready') setState({ ...state, error: 'Échec de la copie : sélectionnez le lien.' }); },
    );
  };

  return (
    <Dialog
      title="Partager un lien"
      size="sm"
      onClose={onClose}
      actions={<Button variant="ghost" onClick={onClose}>Fermer</Button>}
    >
      <div className={styles.body}>
        <div className={styles.row}>
          <span className={styles.label} id={labelId}>Lien public</span>
          <Switch
            checked={state.status === 'ready' && state.token !== null}
            disabled={state.status !== 'ready' || state.pending}
            onChange={(next) => void toggle(next)}
            aria-labelledby={labelId}
          />
        </div>
        <p className={styles.hint}>
          {url
            ? <>Toute personne ayant le lien peut voir «&nbsp;{title}&nbsp;», sans pouvoir le modifier.</>
            : 'Le dessin n’est visible que par vous et vos collaborateurs.'}
        </p>
        {url && (
          <div className={styles.linkRow}>
            <Input
              label="Lien"
              value={url}
              readOnly
              onFocus={(e) => e.currentTarget.select()}
            />
            <Button
              variant="primary"
              iconLeft={copied ? 'check' : 'link'}
              onClick={copy}
            >
              {copied ? 'Copié' : 'Copier'}
            </Button>
          </div>
        )}
        {state.status === 'ready' && state.error && (
          <p className={styles.error} role="alert">{state.error}</p>
        )}
      </div>
    </Dialog>
  );
}
