import { useCallback, useEffect, useEffectEvent, useState } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/Button';
import type { ButtonSize } from '@/components/Button';
import { InlineConfirm } from '@/components/InlineConfirm';
import { useAnchoredMenu } from '@/hooks/useAnchoredMenu';
import type { CollaboratorRole } from '@/types';
import styles from './MembersMenu.module.scss';

export interface MenuMember {
  user_id: string;
  username: string | null;
  /** Absent pour les membres d'un groupe : pas de badge de rôle. */
  role?: CollaboratorRole;
}

export interface MembersMenuProps {
  /** Libellé accessible du déclencheur. */
  label: string;
  title?: string;
  size?: ButtonSize;
  load: () => Promise<MenuMember[]>;
  remove: (userId: string) => Promise<void>;
  canRemove: (member: MenuMember) => boolean;
  /** Notifie un retrait réussi (compteur de carte, partages hérités…). */
  onRemoved?: () => void;
  emptyMessage: string;
  confirmMessage: ReactNode;
  removeLabel: (name: string) => string;
  /** Dans un en-tête déplaçable : le pointerdown du déclencheur ne doit pas lancer le glisser. */
  stopPointerPropagation?: boolean;
}

/** Doit correspondre à `min-width` de `.menu`. */
const MENU_FALLBACK_WIDTH = 240;

const ROLE_LABEL: Record<CollaboratorRole, string> = { owner: 'propriétaire', editor: 'éditeur' };

/** Liste déroulante des membres (collaborateurs d'un dessin ou d'un groupe) avec retrait confirmé. */
export function MembersMenu({
  label,
  title,
  size,
  load,
  remove,
  canRemove,
  onRemoved,
  emptyMessage,
  confirmMessage,
  removeLabel,
  stopPointerPropagation = false,
}: MembersMenuProps) {
  const [open, setOpen] = useState(false);
  const [members, setMembers] = useState<MenuMember[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const loading = open && members === null && !loadFailed;

  // La liste n'est pas gardée à la fermeture : à la réouverture elle est rechargée (une invitation
  // ou un retrait entre-temps la rendrait fausse). Un échec n'est retenté qu'à la réouverture.
  const close = useCallback(() => {
    setOpen(false);
    setMembers(null);
    setLoadFailed(false);
    setConfirmingId(null);
    setActionError(null);
  }, []);
  const { rootRef, menuRef, position } = useAnchoredMenu({
    open,
    onDismiss: close,
    fallbackWidth: MENU_FALLBACK_WIDTH,
  });

  // `load` est souvent une fonction inline : la lire via un effect event évite de relancer
  // (et d'annuler) le chargement à chaque rendu du parent.
  const fetchMembers = useEffectEvent(() => load());

  useEffect(() => {
    if (!loading) return;
    let cancelled = false;
    fetchMembers()
      .then((rows) => { if (!cancelled) setMembers(rows); })
      .catch(() => { if (!cancelled) setLoadFailed(true); });
    return () => { cancelled = true; };
  }, [loading]);

  const handleRemove = async (userId: string) => {
    setRemovingId(userId);
    setActionError(null);
    try {
      await remove(userId);
      setMembers((prev) => prev?.filter((m) => m.user_id !== userId) ?? null);
      onRemoved?.();
    } catch {
      // Pas d'état d'échec global ici : il masquerait toute la liste sans moyen de la retrouver.
      setActionError('Retrait impossible. Réessayez.');
    } finally {
      setRemovingId(null);
      setConfirmingId(null);
    }
  };

  return (
    <div ref={rootRef} className={styles.root} onClick={(e) => e.stopPropagation()}>
      <Button
        variant="ghost"
        size={size}
        iconOnly
        iconLeft="collaborators"
        aria-label={label}
        title={title}
        aria-haspopup="menu"
        aria-expanded={open}
        onPointerDown={stopPointerPropagation ? (e) => e.stopPropagation() : undefined}
        onClick={() => (open ? close() : setOpen(true))}
      />
      {open && position && createPortal(
        <ul
          ref={menuRef}
          role="menu"
          className={styles.menu}
          style={{ top: position.top, left: position.left }}
          onClick={(e) => e.stopPropagation()}
        >
          {loading && <li className={styles.state}>Chargement…</li>}
          {loadFailed && <li className={styles.state}>Erreur de chargement.</li>}
          {actionError && <li role="alert" className={styles.state}>{actionError}</li>}
          {members?.length === 0 && <li className={styles.state}>{emptyMessage}</li>}
          {members?.map((m, idx) => {
            const name = m.username ?? 'utilisateur';
            return (
              <li key={m.user_id} role="none" className={styles.row}>
                {confirmingId === m.user_id ? (
                  <InlineConfirm
                    className={styles.confirm}
                    message={confirmMessage}
                    busy={removingId === m.user_id}
                    onConfirm={() => void handleRemove(m.user_id)}
                    onCancel={() => setConfirmingId(null)}
                  />
                ) : (
                  <span role="menuitem" className={styles.item}>
                    <span className={styles.username}>{m.username ? `@${m.username}` : '—'}</span>
                    {m.role && (
                      <span className={styles.role} data-role={m.role}>{ROLE_LABEL[m.role]}</span>
                    )}
                    {canRemove(m) && (
                      <Button
                        variant="ghost"
                        size="sm"
                        iconOnly
                        iconLeft="trash"
                        aria-label={removeLabel(name)}
                        onClick={() => setConfirmingId(m.user_id)}
                      />
                    )}
                  </span>
                )}
                {idx < members.length - 1 && <span className={styles.divider} aria-hidden="true" />}
              </li>
            );
          })}
        </ul>,
        document.body,
      )}
    </div>
  );
}
