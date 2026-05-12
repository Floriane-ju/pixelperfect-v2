import { useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { DrawingThumbnail } from '@/routes/Gallery/DrawingThumbnail/DrawingThumbnail';
import { Menu } from '@/components/Menu';
import type { MenuItem } from '@/components/Menu';
import type { DrawingRow } from '@/types';
import styles from './GroupCard.module.scss';

interface Props {
  name: string;
  drawings: DrawingRow[];
  onOpen: () => void;
  onDropDrawing?: (drawingId: string) => void;
  onRename?: (newName: string) => void;
  onUngroup?: () => void;
  onDelete?: () => void;
  existingGroupNames?: string[];
}

const MAX_PREVIEWS = 5;
// 46 = $thumb-size (54) − 2×$border-width (2px outer) − 2×$border-width (2px inner)
const THUMB_RENDER_SIZE = 46;

type Mode = 'default' | 'renaming';

export function GroupCard({ name, drawings, onOpen, onDropDrawing, onRename, onUngroup, onDelete, existingGroupNames }: Props) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [mode, setMode] = useState<Mode>('default');
  const [renameValue, setRenameValue] = useState(name);
  const inputRef = useRef<HTMLInputElement>(null);
  const previews = drawings.slice(0, MAX_PREVIEWS);

  const commitRename = () => {
    const trimmed = renameValue.trim();
    const isDuplicate = existingGroupNames?.some((n) => n !== name && n === trimmed);
    if (trimmed && trimmed !== name && !isDuplicate) onRename?.(trimmed);
    setMode('default');
  };

  const handleRenameKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') commitRename();
    if (e.key === 'Escape') setMode('default');
  };

  const menuItems: MenuItem[] = [
    ...(onUngroup ? [{ label: 'Dissocier', icon: 'duplicate' as const, onClick: onUngroup }] : []),
    ...(onRename
      ? [{
          label: 'Renommer',
          icon: 'edit' as const,
          onClick: () => {
            setRenameValue(name);
            setMode('renaming');
            setTimeout(() => inputRef.current?.select(), 0);
          },
        }]
      : []),
    ...(onDelete ? [{ label: 'Supprimer', icon: 'trash' as const, onClick: onDelete, variant: 'danger' as const }] : []),
  ];

  return (
    <article
      className={`${styles.card}${isDragOver ? ` ${styles.dropTarget}` : ''}`}
      onClick={() => { if (mode === 'default') onOpen(); }}
      role="button"
      tabIndex={mode === 'default' ? 0 : -1}
      aria-label={`Groupe ${name}`}
      onKeyDown={(e) => {
        if (mode !== 'default') return;
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(); }
      }}
      onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragOver(true); }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);
        const drawingId = e.dataTransfer.getData('text/plain');
        if (drawingId) onDropDrawing?.(drawingId);
      }}
    >
      <header className={styles.header} onClick={(e) => { if (mode === 'renaming') e.stopPropagation(); }}>
        {mode === 'renaming' ? (
          <input
            ref={inputRef}
            autoFocus
            className={styles.renameInput}
            value={renameValue}
            maxLength={80}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={handleRenameKey}
            onBlur={commitRename}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className={styles.title}>{name}</span>
        )}
        {menuItems.length > 0 && mode === 'default' && (
          <Menu ariaLabel={`Options du groupe ${name}`} items={menuItems} />
        )}
      </header>

      <div className={styles.preview}>
        <div className={styles.previewContent}>
          <div className={styles.grid}>
            {previews.map((d) => (
              <div
                key={d.id}
                className={styles.thumb}
                draggable
                onDragStart={(e) => {
                  e.stopPropagation();
                  e.dataTransfer.setData('text/plain', d.id);
                  e.dataTransfer.effectAllowed = 'move';
                }}
              >
                <div className={styles.thumbInner}>
                  <DrawingThumbnail data={d.data} size={THUMB_RENDER_SIZE} />
                </div>
              </div>
            ))}
            <div className={styles.thumbEmpty} aria-hidden="true" />
          </div>
        </div>
      </div>
    </article>
  );
}
