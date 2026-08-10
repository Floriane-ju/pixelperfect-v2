import { useState } from 'react';
import { DrawingThumbnail } from '@/routes/Gallery/DrawingThumbnail/DrawingThumbnail';
import { Menu } from '@/components/Menu';
import type { MenuItem } from '@/components/Menu';
import { useInlineRename } from '@/hooks/useInlineRename';
import { cx } from '@/lib/cx';
import type { DrawingRow } from '@/types';
import styles from './GroupCard.module.scss';

export interface GroupCardProps {
  name: string;
  drawings: DrawingRow[];
  onOpen: () => void;
  onDropDrawing?: (drawingId: string) => void;
  onShare?: () => void;
  onRename?: (newName: string) => void;
  onUngroup?: () => void;
  onDelete?: () => void;
  existingGroupNames?: string[];
}

const MAX_PREVIEWS = 5;

export function GroupCard({
  name,
  drawings,
  onOpen,
  onDropDrawing,
  onShare,
  onRename,
  onUngroup,
  onDelete,
  existingGroupNames,
}: GroupCardProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const rename = useInlineRename({
    currentName: name,
    onRename,
    isTaken: (next) => existingGroupNames?.some((n) => n !== name && n === next) ?? false,
  });
  const previews = drawings.slice(0, MAX_PREVIEWS);

  const menuItems: MenuItem[] = [
    ...(onShare ? [{ label: 'Partager…', icon: 'collaborators' as const, onClick: onShare }] : []),
    ...(onUngroup ? [{ label: 'Dissocier', icon: 'duplicate' as const, onClick: onUngroup }] : []),
    ...(onRename ? [{ label: 'Renommer', icon: 'edit' as const, onClick: rename.start }] : []),
    ...(onDelete ? [{ label: 'Supprimer', icon: 'trash' as const, onClick: onDelete, variant: 'danger' as const }] : []),
  ];

  return (
    <article
      className={cx(styles.card, isDragOver && styles.dropTarget)}
      onClick={() => { if (!rename.isRenaming) onOpen(); }}
      role="button"
      tabIndex={rename.isRenaming ? -1 : 0}
      aria-label={`Groupe ${name}`}
      onKeyDown={(e) => {
        if (rename.isRenaming) return;
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
      <header className={styles.header} onClick={(e) => { if (rename.isRenaming) e.stopPropagation(); }}>
        {rename.isRenaming ? (
          <input
            autoFocus
            className={styles.renameInput}
            maxLength={80}
            onClick={(e) => e.stopPropagation()}
            {...rename.inputProps}
          />
        ) : (
          <span className={styles.title}>{name}</span>
        )}
        {menuItems.length > 0 && !rename.isRenaming && (
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
                  <DrawingThumbnail data={d.data} />
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
