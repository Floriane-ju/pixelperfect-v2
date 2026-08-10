import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/Button';
import { InlineConfirm } from '@/components/InlineConfirm';
import { useAnchoredMenu } from '@/hooks/useAnchoredMenu';
import { listGroupMembers, removeGroupMember, type GroupMember } from '@/lib/groupSharing';
import styles from './GroupMembersButton.module.scss';

export interface GroupMembersButtonProps {
  groupName: string;
  /** Notifie le retrait d'un membre : les dessins hérités viennent d'être départagés. */
  onRemoved?: () => void;
}

/** Doit correspondre à `min-width` de `.menu`. */
const MENU_FALLBACK_WIDTH = 240;

type Status = 'idle' | 'loading' | 'error';

export function GroupMembersButton({ groupName, onRemoved }: GroupMembersButtonProps) {
  const [open, setOpen] = useState(false);
  const [members, setMembers] = useState<GroupMember[] | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const close = useCallback(() => setOpen(false), []);
  const { rootRef, menuRef, position } = useAnchoredMenu({
    open,
    onDismiss: close,
    fallbackWidth: MENU_FALLBACK_WIDTH,
  });

  // Le nom du groupe est sa clé : après un renommage, la liste chargée n'est plus la bonne.
  useEffect(() => {
    setMembers(null);
    setStatus('idle');
  }, [groupName]);

  const handleRemove = useCallback(async (userId: string) => {
    setRemovingId(userId);
    try {
      await removeGroupMember(groupName, userId);
      setMembers((prev) => prev?.filter((m) => m.user_id !== userId) ?? null);
      onRemoved?.();
    } catch {
      setStatus('error');
    } finally {
      setRemovingId(null);
      setConfirmingId(null);
    }
  }, [groupName, onRemoved]);

  useEffect(() => {
    if (!open || members !== null || status === 'loading') return;
    setStatus('loading');
    listGroupMembers(groupName)
      .then((rows) => { setMembers(rows); setStatus('idle'); })
      .catch(() => setStatus('error'));
  }, [open, groupName, members, status]);

  return (
    <div ref={rootRef} className={styles.root} onClick={(e) => e.stopPropagation()}>
      <Button
        variant="ghost"
        iconOnly
        iconLeft="collaborators"
        aria-label="Membres du groupe"
        title="Membres du groupe"
        aria-haspopup="menu"
        aria-expanded={open}
        onPointerDown={(e) => e.stopPropagation()}
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
          {status === 'loading' && <li className={styles.state}>Chargement…</li>}
          {status === 'error' && <li className={styles.state}>Erreur de chargement.</li>}
          {status === 'idle' && members && members.length === 0 && (
            <li className={styles.state}>Groupe non partagé.</li>
          )}
          {status === 'idle' && members?.map((m, idx) => (
            <li key={m.user_id} role="none" className={styles.row}>
              {confirmingId === m.user_id ? (
                <InlineConfirm
                  className={styles.confirm}
                  message={<>Retirer du groupe&nbsp;?</>}
                  busy={removingId === m.user_id}
                  onConfirm={() => void handleRemove(m.user_id)}
                  onCancel={() => setConfirmingId(null)}
                />
              ) : (
                <span role="menuitem" className={styles.item}>
                  <span className={styles.username}>{m.username ? `@${m.username}` : '—'}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    iconOnly
                    iconLeft="trash"
                    aria-label={`Retirer ${m.username ?? 'utilisateur'} du groupe`}
                    onClick={() => setConfirmingId(m.user_id)}
                  />
                </span>
              )}
              {idx < members.length - 1 && <span className={styles.divider} aria-hidden="true" />}
            </li>
          ))}
        </ul>,
        document.body,
      )}
    </div>
  );
}
