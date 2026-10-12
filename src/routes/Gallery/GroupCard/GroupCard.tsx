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

/** Mosaïque 2 × 2 : trois aperçus et une case vide en pointillé. */
/** Mosaïque 2 × 2 : les cases sans dessin restent en pointillé. */
const MOSAIC_SLOTS = 4;

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
  const previews = drawings.slice(0, MOSAIC_SLOTS);
  const emptySlots = Array.from({ length: MOSAIC_SLOTS - previews.length }, (_, i) => i);

  const menuItems: MenuItem[] = [
    ...(onShare ? [{ label: 'Partager…', icon: 'collaborators' as const, onClick: onShare }] : []),
    ...(onUngroup ? [{ label: 'Dissocier', icon: 'duplicate' as const, onClick: onUngroup }] : []),
    ...(onRename ? [{ label: 'Renommer', icon: 'edit' as const, onClick: rename.start }] : []),
    ...(onDelete
      ? [
          {
            label: 'Supprimer',
            icon: 'trash' as const,
            onClick: onDelete,
            variant: 'danger' as const,
          },
        ]
      : []),
  ];

  const count = drawings.length;

  return (
    <article
      className={styles.card}
      aria-label={`Groupe ${name}`}
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(true);
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);
        const drawingId = e.dataTransfer.getData('text/plain');
        if (drawingId) onDropDrawing?.(drawingId);
      }}
    >
      <div className={styles.head}>
        <span className={styles.num} aria-hidden="true">
          GR
        </span>
        <span className={styles.meta}>
          {count} dessin{count > 1 ? 's' : ''}
        </span>
        {menuItems.length > 0 && !rename.isRenaming && (
          <Menu ariaLabel={`Options du groupe ${name}`} items={menuItems} />
        )}
      </div>

      <div
        className={cx(styles.preview, isDragOver && styles.dropTarget)}
        role="button"
        tabIndex={rename.isRenaming ? -1 : 0}
        aria-label={`Ouvrir le groupe ${name}`}
        onClick={() => {
          if (!rename.isRenaming) onOpen();
        }}
        onKeyDown={(e) => {
          if (rename.isRenaming) return;
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onOpen();
          }
        }}
      >
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
            <span className={styles.thumbInner}>
              <DrawingThumbnail drawing={d} />
            </span>
          </div>
        ))}
        {emptySlots.map((i) => (
          <span key={i} className={styles.thumbEmpty} aria-hidden="true" />
        ))}
      </div>

      {rename.isRenaming ? (
        <input
          autoFocus
          className={styles.renameInput}
          aria-label="Nom du groupe"
          maxLength={80}
          {...rename.inputProps}
        />
      ) : (
        <span className={styles.name}>{name}</span>
      )}
    </article>
  );
}
