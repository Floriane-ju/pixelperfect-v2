import { useState } from 'react';
import type { DrawingRow } from '@/types';
import { DrawingThumbnail } from '@/routes/Gallery/DrawingThumbnail/DrawingThumbnail';
import { InlineConfirm } from '@/components/InlineConfirm';
import { Menu } from '@/components/Menu';
import type { MenuItem } from '@/components/Menu';
import { useInlineRename } from '@/hooks/useInlineRename';
import { cx } from '@/lib/cx';
import { CollaboratorsButton } from './CollaboratorsButton';
import styles from './DrawingCard.module.scss';

export interface DrawingCardProps {
  drawing: DrawingRow;
  isOwner?: boolean;
  onClick?: () => void;
  onRename?: (newTitle: string) => void;
  onDelete?: () => void;
  onRemoveFromGroup?: () => void;
  onInvite?: () => void;
  onCollaboratorRemoved?: () => void;
  onDropDrawing?: (sourceId: string) => void;
}

const THUMB_RENDER_SIZE = 174;

export function DrawingCard({
  drawing,
  isOwner = false,
  onClick,
  onRename,
  onDelete,
  onRemoveFromGroup,
  onInvite,
  onCollaboratorRemoved,
  onDropDrawing,
}: DrawingCardProps) {
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const rename = useInlineRename({ currentName: drawing.title, onRename });

  const isIdle = !rename.isRenaming && !isConfirmingDelete;

  const menuItems: MenuItem[] = [
    ...(onRename
      ? [{ label: 'Renommer', icon: 'edit' as const, onClick: rename.start }]
      : []),
    ...(onRemoveFromGroup
      ? [{ label: 'Retirer du groupe', icon: 'back' as const, onClick: () => onRemoveFromGroup() }]
      : []),
    ...(onInvite
      ? [{ label: 'Inviter…', icon: 'add' as const, onClick: () => onInvite() }]
      : []),
    ...(onDelete
      ? [{ label: 'Supprimer', icon: 'trash' as const, variant: 'danger' as const, onClick: () => setIsConfirmingDelete(true) }]
      : []),
  ];

  return (
    <article
      className={cx(
        styles.card,
        isDragging && styles.dragging,
        isDragOver && styles.dropTarget,
      )}
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
      onClick={() => { if (isIdle) onClick?.(); }}
      onKeyDown={(e) => {
        if (isIdle && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onClick?.();
        }
      }}
      role="button"
      tabIndex={isIdle ? 0 : -1}
      aria-label={drawing.title}
    >
      {isConfirmingDelete ? (
        <InlineConfirm
          layout="column"
          className={styles.confirmRow}
          message={<>Supprimer «&nbsp;{drawing.title}&nbsp;» ?</>}
          onConfirm={() => { onDelete?.(); setIsConfirmingDelete(false); }}
          onCancel={() => setIsConfirmingDelete(false)}
        />
      ) : (
        <>
          <header className={styles.header} onClick={(e) => e.stopPropagation()}>
            {rename.isRenaming ? (
              <input
                autoFocus
                className={styles.renameInput}
                maxLength={80}
                {...rename.inputProps}
              />
            ) : (
              <span className={styles.title}>{drawing.title}</span>
            )}
            {isIdle && drawing.collaborator_count >= 1 && (
              <CollaboratorsButton
                drawingId={drawing.id}
                count={drawing.collaborator_count}
                canRemove={isOwner}
                onRemoved={onCollaboratorRemoved}
              />
            )}
            {menuItems.length > 0 && isIdle && (
              <Menu items={menuItems} ariaLabel="Actions" />
            )}
          </header>
          <div className={styles.preview}>
            <div className={styles.previewInner}>
              <DrawingThumbnail data={drawing.data} size={THUMB_RENDER_SIZE} />
            </div>
          </div>
        </>
      )}
    </article>
  );
}
