import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/Button';
import { listCollaborators, removeCollaborator, type CollaboratorInfo } from '@/lib/drawings';
import styles from './CollaboratorsButton.module.scss';

interface Props {
  drawingId: string;
  count: number;
  canRemove?: boolean;
  onRemoved?: () => void;
}

interface Position {
  top: number;
  left: number;
}

const MENU_GAP = 4;
const MENU_MIN_WIDTH = 240;

type Status = 'idle' | 'loading' | 'error';

export function CollaboratorsButton({ drawingId, count, canRemove = false, onRemoved }: Props) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<Position | null>(null);
  const [collaborators, setCollaborators] = useState<CollaboratorInfo[] | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);

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

  const updatePosition = useCallback(() => {
    const root = rootRef.current;
    const menu = menuRef.current;
    if (!root) return;
    const width = menu?.offsetWidth ?? MENU_MIN_WIDTH;
    const rect = root.getBoundingClientRect();
    const left = Math.max(MENU_GAP, Math.min(rect.right - width, window.innerWidth - width - MENU_GAP));
    setPosition({ top: rect.bottom + MENU_GAP, left });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return;
    const handlePointer = (e: PointerEvent) => {
      const target = e.target as Node;
      if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const handleReposition = () => updatePosition();
    document.addEventListener('pointerdown', handlePointer);
    document.addEventListener('keydown', handleKey);
    window.addEventListener('resize', handleReposition);
    window.addEventListener('scroll', handleReposition, true);
    return () => {
      document.removeEventListener('pointerdown', handlePointer);
      document.removeEventListener('keydown', handleKey);
      window.removeEventListener('resize', handleReposition);
      window.removeEventListener('scroll', handleReposition, true);
    };
  }, [open, updatePosition]);

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
            const isConfirming = confirmingId === c.user_id;
            const isRemoving = removingId === c.user_id;
            return (
              <li key={c.user_id} role="none" className={styles.row}>
                {isConfirming ? (
                  <div className={styles.confirm}>
                    <span className={styles.confirmLabel}>Retirer&nbsp;?</span>
                    <button
                      type="button"
                      className={styles.confirmYes}
                      disabled={isRemoving}
                      onClick={() => void handleRemove(c.user_id)}
                    >
                      Oui
                    </button>
                    <button
                      type="button"
                      className={styles.confirmNo}
                      disabled={isRemoving}
                      onClick={() => setConfirmingId(null)}
                    >
                      Non
                    </button>
                  </div>
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
