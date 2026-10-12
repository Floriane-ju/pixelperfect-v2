import { useState } from 'react';
import type { PointerEvent } from 'react';
import type { DrawingRow } from '@/types';
import { DrawingThumbnail } from '@/routes/Gallery/DrawingThumbnail/DrawingThumbnail';
import { Button } from '@/components/Button';
import { InlineConfirm } from '@/components/InlineConfirm';
import { Menu } from '@/components/Menu';
import type { MenuItem } from '@/components/Menu';
import { MembersMenu } from '@/components/MembersMenu';
import { useInlineRename } from '@/hooks/useInlineRename';
import { listCollaborators, removeCollaborator } from '@/lib/drawings';
import { cx } from '@/lib/cx';
import styles from './DrawingCard.module.scss';

export interface DrawingCardProps {
  drawing: DrawingRow;
  /** Position dans la liste (0 → « 01 »). */
  index: number;
  isOwner?: boolean;
  onClick?: () => void;
  onRename?: (newTitle: string) => void;
  onDelete?: () => void;
  onRemoveFromGroup?: () => void;
  onInvite?: () => void;
  onShareLink?: () => void;
  onCollaboratorRemoved?: () => void;
  onDropDrawing?: (sourceId: string) => void;
}

/** Les boutons du renommage ne doivent pas voler le focus au champ (son blur valide). */
const keepFocus = (e: PointerEvent) => e.preventDefault();

export function DrawingCard({
  drawing,
  index,
  isOwner = false,
  onClick,
  onRename,
  onDelete,
  onRemoveFromGroup,
  onInvite,
  onShareLink,
  onCollaboratorRemoved,
  onDropDrawing,
}: DrawingCardProps) {
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const rename = useInlineRename({ currentName: drawing.title, onRename });

  const isIdle = !rename.isRenaming && !isConfirmingDelete;
  const number = String(index + 1).padStart(2, '0');

  const menuItems: MenuItem[] = [
    ...(onRename ? [{ label: 'Renommer', icon: 'edit' as const, onClick: rename.start }] : []),
    ...(onRemoveFromGroup
      ? [{ label: 'Retirer du groupe', icon: 'back' as const, onClick: () => onRemoveFromGroup() }]
      : []),
    ...(onInvite ? [{ label: 'Inviter…', icon: 'add' as const, onClick: () => onInvite() }] : []),
    ...(onShareLink ? [{ label: 'Partager un lien', icon: 'link' as const, onClick: () => onShareLink() }] : []),
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
    <article
      className={cx(styles.card, isDragging && styles.dragging)}
      aria-label={drawing.title}
      draggable={isIdle}
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
    >
      <div className={styles.head}>
        <span className={styles.num} aria-hidden="true">{number}</span>
        <span className={styles.meta}>
          {drawing.data.width} × {drawing.data.height} px
        </span>
        {isIdle && drawing.collaborator_count >= 1 && (
          <MembersMenu
            label={`Collaborateurs (${drawing.collaborator_count})`}
            load={() => listCollaborators(drawing.id)}
            remove={(userId) => removeCollaborator(drawing.id, userId)}
            canRemove={(m) => isOwner && m.role !== 'owner'}
            onRemoved={onCollaboratorRemoved}
            emptyMessage="Aucun collaborateur."
            confirmMessage={<>Retirer&nbsp;?</>}
            removeLabel={(name) => `Retirer ${name}`}
          />
        )}
        {menuItems.length > 0 && isIdle && (
          <Menu items={menuItems} ariaLabel={`Options de ${drawing.title}`} />
        )}
      </div>

      {isConfirmingDelete ? (
        <div className={styles.confirm} role="alertdialog" aria-label="Confirmer la suppression">
          <InlineConfirm
            layout="column"
            message={<>Supprimer «&nbsp;{drawing.title}&nbsp;» ?</>}
            confirmLabel="Supprimer"
            cancelLabel="Annuler"
            onConfirm={() => {
              onDelete?.();
              setIsConfirmingDelete(false);
            }}
            onCancel={() => setIsConfirmingDelete(false)}
          />
        </div>
      ) : (
        // `div role="button"` plutôt que `<button>` : Firefox ne lance pas de glisser depuis un bouton.
        <div
          className={cx(styles.preview, isDragOver && styles.dropTarget)}
          role="button"
          tabIndex={isIdle ? 0 : -1}
          aria-label={`Ouvrir ${drawing.title}`}
          onClick={() => { if (isIdle) onClick?.(); }}
          onKeyDown={(e) => {
            if (isIdle && (e.key === 'Enter' || e.key === ' ')) {
              e.preventDefault();
              onClick?.();
            }
          }}
        >
          <span className={styles.previewInner}>
            <DrawingThumbnail drawing={drawing} />
          </span>
        </div>
      )}

      {rename.isRenaming ? (
        <div className={styles.renameRow}>
          <input
            className={styles.renameInput}
            aria-label="Nom du dessin"
            maxLength={80}
            autoFocus
            {...rename.inputProps}
          />
          <Button
            variant="selected"
            size="sm"
            iconOnly
            iconLeft="check"
            aria-label="Valider"
            onPointerDown={keepFocus}
            onClick={() => rename.inputProps.onBlur()}
          />
          <Button
            variant="selectable"
            size="sm"
            iconOnly
            iconLeft="close"
            aria-label="Annuler"
            onPointerDown={keepFocus}
            onClick={rename.cancel}
          />
        </div>
      ) : (
        <span className={styles.name}>{drawing.title}</span>
      )}
    </article>
  );
}
