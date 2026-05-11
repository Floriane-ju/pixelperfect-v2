import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/Button';
import { listCollaboratorsWithEmail, type CollaboratorInfo } from '@/lib/drawings';
import styles from './CollaboratorsButton.module.scss';

interface Props {
  drawingId: string;
  count: number;
}

interface Position {
  top: number;
  left: number;
}

const MENU_GAP = 4;
const MENU_MIN_WIDTH = 240;

type Status = 'idle' | 'loading' | 'error';

export function CollaboratorsButton({ drawingId, count }: Props) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<Position | null>(null);
  const [collaborators, setCollaborators] = useState<CollaboratorInfo[] | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);

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
    listCollaboratorsWithEmail(drawingId)
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
          {status === 'idle' && collaborators?.map((c, idx) => (
            <li key={c.user_id} role="none" className={styles.row}>
              <span role="menuitem" className={styles.item}>{c.email}</span>
              {idx < collaborators.length - 1 && <span className={styles.divider} aria-hidden="true" />}
            </li>
          ))}
        </ul>,
        document.body,
      )}
    </div>
  );
}
