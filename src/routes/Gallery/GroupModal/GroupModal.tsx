import { useEffect, useRef, useState } from 'react';
import type { PointerEvent } from 'react';
import { DrawingCard } from '@/routes/Gallery/DrawingCard/DrawingCard';
import { Button } from '@/components/Button';
import { useModalA11y } from '@/hooks/useModalA11y';
import { useModalZIndex } from '@/lib/modalStack';
import type { DrawingRow } from '@/types';
import styles from './GroupModal.module.scss';

interface Props {
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
}: Props) {
  const { zIndex, raise, initialOffset } = useModalZIndex();
  const [offset, setOffset] = useState(initialOffset);
  const [isOverlayDragOver, setIsOverlayDragOver] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const drag = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = `group-modal-title-${name.replace(/\s+/g, '-')}`;

  useModalA11y({ modalRef: panelRef, onClose });

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

  const onDragStart = (e: PointerEvent<HTMLElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { sx: e.clientX, sy: e.clientY, ox: offset.x, oy: offset.y };
  };

  const onDragMove = (e: PointerEvent<HTMLElement>) => {
    if (!drag.current) return;
    setOffset({
      x: drag.current.ox + e.clientX - drag.current.sx,
      y: drag.current.oy + e.clientY - drag.current.sy,
    });
  };

  const onDragEnd = () => {
    drag.current = null;
  };

  return (
    <div
      className={`${styles.overlay}${isDragging ? ` ${styles.overlayDragActive}` : ''}${isOverlayDragOver ? ` ${styles.overlayDropTarget}` : ''}`}
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
        style={{ transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))`, zIndex }}
        onPointerDownCapture={raise}
        onFocusCapture={raise}
        onDragOver={(e) => e.stopPropagation()}
        onDrop={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <header
          className={styles.header}
          onPointerDown={onDragStart}
          onPointerMove={onDragMove}
          onPointerUp={onDragEnd}
        >
          <div className="deco thin" aria-hidden="true">
            <div/>
            <div/>
            <div/>
          </div>
          <h2 id={titleId} className={styles.title}>{name}</h2>
          <div className="deco" aria-hidden="true">
            <div/>
            <div/>
            <div/>
          </div>
          <Button
            variant="primary"
            iconOnly
            iconLeft="close"
            aria-label="Fermer"
            onClick={(e) => { e.stopPropagation(); onClose(); }}
            onPointerDown={(e) => e.stopPropagation()}
          />
        </header>
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
