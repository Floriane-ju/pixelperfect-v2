import { useEffect, useId, useRef, useState } from 'react';
import { DrawingCard } from '@/routes/Gallery/DrawingCard/DrawingCard';
import { ModalHeader } from '@/components/Modal';
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
    const end = () => { setIsDragging(false); setIsOverlayDragOver(false); };
    window.addEventListener('dragstart', start);
    window.addEventListener('dragend', end);
    return () => {
      window.removeEventListener('dragstart', start);
      window.removeEventListener('dragend', end);
    };
  }, []);

  return (
    <div
      className={cx(
        styles.overlay,
        isDragging && styles.overlayDragActive,
        isOverlayDragOver && styles.overlayDropTarget,
      )}
      style={{ zIndex }}
      onDragOver={(e) => { e.preventDefault(); setIsOverlayDragOver(true); }}
      onDragLeave={() => setIsOverlayDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
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
          tone="accent-2"
          dragHandlers={dragHandlers}
        />
        <div className={styles.content}>
          {drawings.map((d) => {
            const isOwner = currentUserId !== null && d.owner_id === currentUserId;
            return (
              <DrawingCard
                key={d.id}
                drawing={d}
                isOwner={isOwner}
                onClick={() => onCardClick(d.id)}
                onRename={onRename ? (title) => onRename(d.id, title) : undefined}
                onDelete={onDelete && isOwner ? () => onDelete(d.id) : undefined}
                onRemoveFromGroup={onRemoveFromGroup ? () => onRemoveFromGroup(d.id) : undefined}
                onInvite={onInvite && isOwner ? () => onInvite(d) : undefined}
                onCollaboratorRemoved={onCollaboratorRemoved ? () => onCollaboratorRemoved(d.id) : undefined}
              />
            );
          })}
          {drawings.length === 0 && (
            <p className={styles.empty}>Aucun dessin dans ce groupe.</p>
          )}
        </div>
      </div>
    </div>
  );
}
