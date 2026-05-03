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
  onDropDrawing?: (sourceId: string) => void;
}

type Mode = 'default' | 'renaming' | 'confirming-delete';

export function DrawingCard({ drawing, onClick, onRename, onDelete, onRemoveFromGroup, onDropDrawing }: Props) {
  const [mode, setMode] = useState<Mode>('default');
  const [menuOpen, setMenuOpen] = useState(false);
  const [renameValue, setRenameValue] = useState(drawing.title);
  const [isDragging, setIsDragging] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const menuItems: ContextMenuItem[] = [
    ...(onRename
      ? [{
          label: 'Renommer',
          onClick: () => {
            setRenameValue(drawing.title);
            setMode('renaming');
            setTimeout(() => inputRef.current?.select(), 0);
          },
        }]
      : []),
    ...(onRemoveFromGroup
      ? [{ label: 'Retirer du groupe', onClick: () => onRemoveFromGroup() }]
      : []),
    ...(onDelete
      ? [{ label: 'Supprimer', variant: 'danger' as const, onClick: () => setMode('confirming-delete') }]
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

  const classNames = [
    styles.card,
    isDragging ? styles.dragging : '',
    isDragOver ? styles.dropTarget : '',
  ].filter(Boolean).join(' ');

  return (
    <article
      className={classNames}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', drawing.id);
        e.dataTransfer.effectAllowed = 'move';
        setIsDragging(true);
      }}
      onDragEnd={() => setIsDragging(false)}
      onDragOver={(e) => {
        if (!onDropDrawing) return;
        e.preventDefault();
        setIsDragOver(true);
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragOver(false);
        const sourceId = e.dataTransfer.getData('text/plain');
        if (sourceId && sourceId !== drawing.id) onDropDrawing?.(sourceId);
      }}
      onClick={() => { if (mode === 'default') onClick?.(); }}
      role="button"
      tabIndex={mode === 'default' ? 0 : -1}
      aria-label={drawing.title}
    >
      {mode === 'confirming-delete' ? (
        <div className={styles.confirmRow} onClick={(e) => e.stopPropagation()}>
          <span className={styles.confirmLabel}>Supprimer «&nbsp;{drawing.title}&nbsp;» ?</span>
          <div className={styles.confirmActions}>
            <button type="button" className={styles.confirmBtn} onClick={() => { onDelete?.(); setMode('default'); }}>Oui</button>
            <button type="button" className={styles.cancelBtn} onClick={() => setMode('default')}>Non</button>
          </div>
        </div>
      ) : (
        <>
          <header className={styles.header} onClick={(e) => e.stopPropagation()}>
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
            {menuItems.length > 0 && mode === 'default' && (
              <div className={styles.menuAnchor}>
                <button
                  type="button"
                  className={styles.menuBtn}
                  aria-label="Actions"
                  onClick={(e) => { e.stopPropagation(); setMenuOpen((v) => !v); }}
                >
                  <Icons icon="more" size={16} />
                </button>
                {menuOpen && <ContextMenu items={menuItems} onClose={() => setMenuOpen(false)} />}
              </div>
            )}
          </header>
          <div className={styles.preview}>
            <div className={styles.previewInner}>
              <DrawingThumbnail data={drawing.data} size={174} />
            </div>
          </div>
        </>
      )}
    </article>
  );
}
