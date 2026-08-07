import { useRef, useState } from 'react';
import type { DrawingRow } from '@/types';
import { DrawingThumbnail } from '@/routes/Gallery/DrawingThumbnail/DrawingThumbnail';
import { Button } from '@/components/Button';
import { Dialog } from '@/components/Dialog';
import { Input } from '@/components/Input';
import { InlineConfirm } from '@/components/InlineConfirm';
import { Menu } from '@/components/Menu';
import type { MenuItem } from '@/components/Menu';
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
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(drawing.title);
  const renameInputRef = useRef<HTMLInputElement>(null);

  const isIdle = !isRenaming && !isConfirmingDelete;

  const submitRename = () => {
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== drawing.title) onRename?.(trimmed);
    setIsRenaming(false);
  };

  const menuItems: MenuItem[] = [
    ...(onRename
      ? [
          {
            label: 'Renommer',
            icon: 'edit' as const,
            onClick: () => {
              setRenameValue(drawing.title);
              setIsRenaming(true);
            },
          },
        ]
      : []),
    ...(onRemoveFromGroup
      ? [{ label: 'Retirer du groupe', icon: 'back' as const, onClick: () => onRemoveFromGroup() }]
      : []),
    ...(onInvite ? [{ label: 'Inviter…', icon: 'add' as const, onClick: () => onInvite() }] : []),
    ...(onDelete
      ? [
          {
            label: 'Supprimer',
            icon: 'trash' as const,
            variant: 'danger' as const,
            onClick: () => setIsConfirmingDelete(true),
          },
        ]
      : []),
  ];

  return (
    <>
      <article
        className={cx(styles.card, isDragging && styles.dragging, isDragOver && styles.dropTarget)}
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
        onClick={() => {
          if (isIdle) onClick?.();
        }}
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
            onConfirm={() => {
              onDelete?.();
              setIsConfirmingDelete(false);
            }}
            onCancel={() => setIsConfirmingDelete(false)}
          />
        ) : (
          <>
            <header className={styles.header} onClick={(e) => e.stopPropagation()}>
              <span className={styles.titleGroup}>
                <span className={styles.title}>{drawing.title}</span>
                <span className={styles.titleSize}>
                  {drawing.data.width} × {drawing.data.height} px
                </span>
              </span>
              {isIdle && drawing.collaborator_count >= 1 && (
                <CollaboratorsButton
                  drawingId={drawing.id}
                  count={drawing.collaborator_count}
                  canRemove={isOwner}
                  onRemoved={onCollaboratorRemoved}
                />
              )}
              {menuItems.length > 0 && isIdle && <Menu items={menuItems} ariaLabel="Actions" />}
            </header>
            <div className={styles.preview}>
              <div className={styles.previewInner}>
                <DrawingThumbnail data={drawing.data} size={THUMB_RENDER_SIZE} />
              </div>
            </div>
          </>
        )}
      </article>
      {isRenaming && (
        <Dialog
          title="Renommer le dessin"
          onClose={() => setIsRenaming(false)}
          initialFocusRef={renameInputRef}
          actions={
            <>
              <Button variant="ghost" size="sm" onClick={() => setIsRenaming(false)}>
                Annuler
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={submitRename}
                disabled={!renameValue.trim()}
              >
                Valider
              </Button>
            </>
          }
        >
          <Input
            ref={renameInputRef}
            id={`drawing-rename-${drawing.id}`}
            label="Nom"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            maxLength={80}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submitRename();
            }}
          />
        </Dialog>
      )}
    </>
  );
}
