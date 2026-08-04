import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/Button';
import { InlineConfirm } from '@/components/InlineConfirm';
import { useAnchoredMenu } from '@/hooks/useAnchoredMenu';
import { listCollaborators, removeCollaborator, type CollaboratorInfo } from '@/lib/drawings';
import styles from './CollaboratorsButton.module.scss';

export interface CollaboratorsButtonProps {
  drawingId: string;
  count: number;
  canRemove?: boolean;
  onRemoved?: () => void;
}

/** Doit correspondre à `min-width` de `.menu`. */
const MENU_FALLBACK_WIDTH = 240;

type Status = 'idle' | 'loading' | 'error';

export function CollaboratorsButton({
  drawingId,
  count,
  canRemove = false,
  onRemoved,
}: CollaboratorsButtonProps) {
  const [open, setOpen] = useState(false);
  const [collaborators, setCollaborators] = useState<CollaboratorInfo[] | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const close = useCallback(() => setOpen(false), []);
  const { rootRef, menuRef, position } = useAnchoredMenu({
    open,
    onDismiss: close,
    fallbackWidth: MENU_FALLBACK_WIDTH,
  });

  const handleRemove = useCallback(async (userId: string) => {
    setRemovingId(userId);
    try {
      await removeCollaborator(drawingId, userId);
      setCollaborators((prev) => prev?.filter((c) => c.user_id !== userId) ?? null);
      onRemoved?.();
    } catch {
      setStatus('error');
    } finally {
      setRemovingId(null);
      setConfirmingId(null);
    }
  }, [drawingId, onRemoved]);

  useEffect(() => {
    if (!open || collaborators !== null || status === 'loading') return;
    setStatus('loading');
    listCollaborators(drawingId)
      .then((rows) => { setCollaborators(rows); setStatus('idle'); })
      .catch(() => setStatus('error'));
  }, [open, drawingId, collaborators, status]);

  return (
    <div
      ref={rootRef}
      className={styles.root}
      onClick={(e) => e.stopPropagation()}
    >
      <Button
        variant="ghost"
        size="sm"
        iconOnly
        iconLeft="collaborators"
        aria-label={`Collaborateurs (${count})`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      />
      {open && position && createPortal(
        <ul
          ref={menuRef}
          role="menu"
          className={styles.menu}
          style={{ top: position.top, left: position.left }}
          onClick={(e) => e.stopPropagation()}
        >
          {status === 'loading' && (
            <li className={styles.state}>Chargement…</li>
          )}
          {status === 'error' && (
            <li className={styles.state}>Erreur de chargement.</li>
          )}
          {status === 'idle' && collaborators && collaborators.length === 0 && (
            <li className={styles.state}>Aucun collaborateur.</li>
          )}
          {status === 'idle' && collaborators?.map((c, idx) => {
            const showRemove = canRemove && c.role !== 'owner';
            return (
              <li key={c.user_id} role="none" className={styles.row}>
                {confirmingId === c.user_id ? (
                  <InlineConfirm
                    className={styles.confirm}
                    message={<>Retirer&nbsp;?</>}
                    busy={removingId === c.user_id}
                    onConfirm={() => void handleRemove(c.user_id)}
                    onCancel={() => setConfirmingId(null)}
                  />
                ) : (
                  <span role="menuitem" className={styles.item}>
                    <span className={styles.identity}>
                      <span className={styles.username}>{c.username ? `@${c.username}` : '—'}</span>
                    </span>
                    <span className={styles.role} data-role={c.role}>
                      {c.role === 'owner' ? 'propriétaire' : 'éditeur'}
                    </span>
                    {showRemove && (
                      <Button
                        variant="ghost"
                        size="sm"
                        iconOnly
                        iconLeft="trash"
                        aria-label={`Retirer ${c.username ?? 'utilisateur'}`}
                        onClick={() => setConfirmingId(c.user_id)}
                      />
                    )}
                  </span>
                )}
                {idx < collaborators.length - 1 && <span className={styles.divider} aria-hidden="true" />}
              </li>
            );
          })}
        </ul>,
        document.body,
      )}
    </div>
  );
}
