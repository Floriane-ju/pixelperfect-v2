import { useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import type { DrawingRow } from '@/types';
import { DrawingThumbnail } from '@/routes/Gallery/DrawingThumbnail/DrawingThumbnail';
import { Menu } from '@/routes/Gallery/Menu/Menu';
import type { MenuItem } from '@/routes/Gallery/Menu/Menu';
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
  const [renameValue, setRenameValue] = useState(drawing.title);
  const [isDragging, setIsDragging] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const menuItems: MenuItem[] = [
    ...(onRename
      ? [{
          label: 'Renommer',
          icon: 'edit' as const,
          onClick: () => {
            setRenameValue(drawing.title);
            setMode('renaming');
            setTimeout(() => inputRef.current?.select(), 0);
          },
        }]
      : []),
    ...(onRemoveFromGroup
      ? [{ label: 'Retirer du groupe', icon: 'back' as const, onClick: () => onRemoveFromGroup() }]
      : []),
    ...(onDelete
      ? [{ label: 'Supprimer', icon: 'trash' as const, variant: 'danger' as const, onClick: () => setMode('confirming-delete') }]
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
        e.stopPropagation();
        setIsDragOver(true);
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);
        const sourceId = e.dataTransfer.getData('text/plain');
        if (sourceId && sourceId !== drawing.id) onDropDrawing?.(sourceId);
      }}
      onClick={() => { if (mode === 'default') onClick?.(); }}
      onKeyDown={(e) => {
        if (mode === 'default' && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onClick?.();
        }
      }}
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
          <header className={`${styles.header} accent2`} onClick={(e) => e.stopPropagation()}>
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
              <Menu items={menuItems} ariaLabel="Actions" />
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
