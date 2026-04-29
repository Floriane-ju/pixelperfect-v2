import { useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import type { DrawingRow } from '@/types';
import { DrawingThumbnail } from '@/components/DrawingThumbnail';
import { ContextMenu } from '@/components/ContextMenu';
import { Icons } from '@/components/Icons';
import type { ContextMenuItem } from '@/components/ContextMenu';
import styles from './DrawingCard.module.scss';

interface Props {
  drawing: DrawingRow;
  onClick?: () => void;
  onRename?: (newTitle: string) => void;
  onDelete?: () => void;
  onRemoveFromGroup?: () => void;
}

type Mode = 'default' | 'renaming' | 'confirming-delete';

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

export function DrawingCard({ drawing, onClick, onRename, onDelete, onRemoveFromGroup }: Props) {
  const [mode, setMode] = useState<Mode>('default');
  const [menuOpen, setMenuOpen] = useState(false);
  const [renameValue, setRenameValue] = useState(drawing.title);
  const inputRef = useRef<HTMLInputElement>(null);

  const menuItems: ContextMenuItem[] = [
    ...(onRename
      ? [
          {
            label: 'Renommer',
            onClick: () => {
              setRenameValue(drawing.title);
              setMode('renaming');
              setTimeout(() => inputRef.current?.select(), 0);
            },
          },
        ]
      : []),
    ...(onRemoveFromGroup
      ? [{ label: 'Retirer du groupe', onClick: () => onRemoveFromGroup() }]
      : []),
    ...(onDelete
      ? [
          {
            label: 'Supprimer',
            variant: 'danger' as const,
            onClick: () => setMode('confirming-delete'),
          },
        ]
      : []),
  ];

  const commitRename = () => {
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== drawing.title) onRename?.(trimmed);
    setMode('default');
  };

  const handleRenameKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') commitRename();
    if (e.key === 'Escape') setMode('default');
  };

  const handleCardClick = () => {
    if (mode !== 'default') return;
    onClick?.();
  };

  return (
    <article
      className={styles.card}
      onClick={handleCardClick}
      role="button"
      tabIndex={mode === 'default' ? 0 : -1}
      aria-label={drawing.title}
    >
      {mode === 'confirming-delete' ? (
        <div className={styles.confirmRow} onClick={(e) => e.stopPropagation()}>
          <span className={styles.confirmLabel}>Supprimer&nbsp;«&nbsp;{drawing.title}&nbsp;»&nbsp;?</span>
          <div className={styles.confirmActions}>
            <button
              type="button"
              className={styles.confirmBtn}
              onClick={() => { onDelete?.(); setMode('default'); }}
            >
              Oui
            </button>
            <button
              type="button"
              className={styles.cancelBtn}
              onClick={() => setMode('default')}
            >
              Non
            </button>
          </div>
        </div>
      ) : (
        <>
          <header className={styles.info} onClick={(e) => e.stopPropagation()}>
            <div className={styles.meta}>
              <span className={styles.metaLabel}>Modifié le</span>
              <span className={styles.metaValue}>{formatDate(drawing.updated_at)}</span>
            </div>
            {mode === 'renaming' ? (
              <input
                ref={inputRef}
                autoFocus
                className={styles.renameInput}
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onKeyDown={handleRenameKey}
                onBlur={commitRename}
              />
            ) : (
              <span className={styles.title}>{drawing.title}</span>
            )}
          </header>

          <div className={styles.preview}>
            <DrawingThumbnail data={drawing.data} size={120} />

            {menuItems.length > 0 && mode === 'default' && (
              <div className={styles.menuAnchor} onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  className={styles.menuBtn}
                  aria-label="Actions"
                  onClick={(e) => { e.stopPropagation(); setMenuOpen((v) => !v); }}
                >
                  <Icons icon="more" size={14} />
                </button>
                {menuOpen && (
                  <ContextMenu items={menuItems} onClose={() => setMenuOpen(false)} />
                )}
              </div>
            )}
          </div>
        </>
      )}
    </article>
  );
}
