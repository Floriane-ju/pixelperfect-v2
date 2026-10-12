import { useState } from 'react';
import type { MenuItem } from '@/components/Menu';
import { useSnackbar } from '@/components/Snackbar';
import { fetchShareToken, publicUrl, setPublicLink } from '@/lib/publicLinks';

export interface UsePublicLinkReturn {
  /** Interrupteur « Lien public » (+ copie quand actif), à placer dans un `<Menu>`. */
  item: MenuItem;
  /** Lit l'état du lien ; à appeler à l'ouverture du menu (sans effet une fois lu). */
  load: () => void;
}

type Status = 'idle' | 'loading' | 'ready' | 'pending';

/** Lien public en lecture seule d'un dessin, piloté depuis un menu (propriétaire connecté). */
export function usePublicLink(drawingId: string): UsePublicLinkReturn {
  const snackbar = useSnackbar();
  const [status, setStatus] = useState<Status>('idle');
  const [token, setToken] = useState<string | null>(null);

  const load = () => {
    if (status !== 'idle') return;
    setStatus('loading');
    fetchShareToken(drawingId).then(
      (t) => { setToken(t); setStatus('ready'); },
      () => { setStatus('idle'); snackbar.show('Impossible de lire l’état du lien'); },
    );
  };

  const toggle = () => {
    if (status !== 'ready') return;
    setStatus('pending');
    setPublicLink(drawingId, token === null).then(
      (t) => { setToken(t); setStatus('ready'); },
      (err: unknown) => {
        setStatus('ready');
        snackbar.show(err instanceof Error ? err.message : 'Échec du changement de lien');
      },
    );
  };

  const copy = () => {
    if (!token) return;
    // Appel synchrone (geste utilisateur exigé par iOS) ; sans presse-papier, l'appel lève.
    let pending: Promise<void>;
    try {
      pending = navigator.clipboard.writeText(publicUrl(token));
    } catch (err) {
      pending = Promise.reject(err);
    }
    pending.then(
      () => snackbar.show('Lien copié', { icon: 'link' }),
      () => snackbar.show('Échec de la copie'),
    );
  };

  return {
    load,
    item: {
      label: 'Lien public',
      icon: 'link',
      checked: token !== null,
      disabled: status !== 'ready',
      onClick: toggle,
      action: token ? { icon: 'duplicate', label: 'Copier le lien', onClick: copy } : undefined,
    },
  };
}
