import { useEffect, useId, useRef, useState } from 'react';
import { DrawingCard } from '@/routes/Gallery/DrawingCard/DrawingCard';
import { MembersMenu } from '@/components/MembersMenu';
import { listGroupMembers, removeGroupMember } from '@/lib/groupSharing';
import { ModalHeader } from '@/components/Modal';
import { Button } from '@/components/Button';
import { Icons } from '@/components/Icons';
import { useModalA11y } from '@/hooks/useModalA11y';
import { useDraggableModal } from '@/hooks/useDraggableModal';
import { cx } from '@/lib/cx';
import type { DrawingRow } from '@/types';
import styles from './GroupModal.module.scss';

export interface GroupModalProps {
  name: string;
  drawings: DrawingRow[];
  currentUserId: string | null;
  onClose: () => void;
  onCardClick: (id: string) => void;
  /** Absent si l'utilisateur ne possède aucun dessin du groupe (ou n'est pas connecté). */
  onShare?: () => void;
  /** Appelé quand le retrait d'un membre a changé les partages hérités du groupe. */
  onSharingChanged?: () => void;
  onNewDrawing?: () => void;
  onRename?: (id: string, title: string) => void;
  onDelete?: (id: string) => void;
  onRemoveFromGroup?: (id: string) => void;
  onInvite?: (drawing: DrawingRow) => void;
  onCollaboratorRemoved?: (drawingId: string) => void;
}

export function GroupModal({
  name,
  drawings,
  currentUserId,
  onClose,
  onCardClick,
  onShare,
  onSharingChanged,
  onNewDrawing,
  onRename,
  onDelete,
  onRemoveFromGroup,
  onInvite,
  onCollaboratorRemoved,
}: GroupModalProps) {
  const { zIndex, panelStyle, raiseHandlers, dragHandlers } = useDraggableModal();
  const [isOverlayDragOver, setIsOverlayDragOver] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useModalA11y({ modalRef: panelRef, onClose });

  // Le voile ne capte les événements que pendant un glisser de carte : sinon il bloquerait
  // les interactions avec la galerie derrière lui.
  useEffect(() => {
    const start = () => setIsDragging(true);
    const end = () => {
      setIsDragging(false);
      setIsOverlayDragOver(false);
    };
    window.addEventListener('dragstart', start);
    window.addEventListener('dragend', end);
    // `dragend` ne part pas toujours : la carte source est retirée du DOM au drop.
    window.addEventListener('drop', end, true);
    return () => {
      window.removeEventListener('dragstart', start);
      window.removeEventListener('dragend', end);
      window.removeEventListener('drop', end, true);
    };
  }, []);

  return (
    <div
      className={cx(
        styles.overlay,
        isDragging && styles.overlayDragActive,
        isOverlayDragOver && styles.overlayDropTarget
      )}
      style={{ zIndex }}
      onDragOver={(e) => {
        e.preventDefault();
        setIsOverlayDragOver(true);
      }}
      onDragLeave={() => setIsOverlayDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragging(false);
        setIsOverlayDragOver(false);
        const drawingId = e.dataTransfer.getData('text/plain');
        if (drawingId) onRemoveFromGroup?.(drawingId);
      }}
    >
      <div
        ref={panelRef}
        className={styles.panel}
        style={panelStyle}
        {...raiseHandlers}
        onDragOver={(e) => e.stopPropagation()}
        onDrop={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <ModalHeader
          title={name}
          titleId={titleId}
          onClose={onClose}
          dragHandlers={dragHandlers}
          actions={
            <>
              {onShare && (
                // Le nom du groupe est sa clé : un renommage remonte le menu (liste rechargée).
                <MembersMenu
                  key={name}
                  variant="ink"
                  label="Membres du groupe"
                  title="Membres du groupe"
                  load={() => listGroupMembers(name)}
                  remove={(userId) => removeGroupMember(name, userId)}
                  canRemove={() => true}
                  onRemoved={onSharingChanged}
                  emptyMessage="Groupe non partagé."
                  confirmMessage={<>Retirer du groupe&nbsp;?</>}
                  removeLabel={(memberName) => `Retirer ${memberName} du groupe`}
                  stopPointerPropagation
                />
              )}
              {onShare && (
                <Button
                  variant="ink"
                  iconOnly
                  iconLeft="export"
                  aria-label="Partager le groupe"
                  title="Partager le groupe"
                  onClick={(e) => {
                    e.stopPropagation();
                    onShare();
                  }}
                  onPointerDown={(e) => e.stopPropagation()}
                />
              )}
            </>
          }
        />
        <div className={styles.content}>
          {drawings.map((d, i) => {
            const isOwner = currentUserId !== null && d.owner_id === currentUserId;
            return (
              <DrawingCard
                key={d.id}
                drawing={d}
                index={i}
                isOwner={isOwner}
                onClick={() => onCardClick(d.id)}
                onRename={onRename ? (title) => onRename(d.id, title) : undefined}
                onDelete={onDelete && isOwner ? () => onDelete(d.id) : undefined}
                onRemoveFromGroup={onRemoveFromGroup ? () => onRemoveFromGroup(d.id) : undefined}
                onInvite={onInvite && isOwner ? () => onInvite(d) : undefined}
                onCollaboratorRemoved={
                  onCollaboratorRemoved ? () => onCollaboratorRemoved(d.id) : undefined
                }
              />
            );
          })}
          {drawings.length === 0 && <p className={styles.empty}>Aucun dessin dans ce groupe.</p>}
          {onNewDrawing && (
            <button
              type="button"
              className={styles.addTile}
              aria-haspopup="dialog"
              onClick={onNewDrawing}
            >
              <span className={styles.addArt} aria-hidden="true">
                <Icons icon="add" size={24} />
              </span>
              <span className={styles.addLabel}>Nouveau dessin</span>
            </button>
          )}
        </div>
        <footer className={styles.footer}>
          <span className={styles.hint}>Glisser une vignette hors du groupe pour l’en retirer</span>
          <Button variant="secondary" onClick={onClose}>
            Fermer
          </Button>
        </footer>
      </div>
    </div>
  );
}
