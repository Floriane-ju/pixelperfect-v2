import { useId, useRef, useState } from 'react';
import type { PointerEvent, ReactNode, RefObject } from 'react';
import { Button } from '@/components/Button';
import { useModalA11y } from '@/hooks/useModalA11y';
import { useModalZIndex } from '@/lib/modalStack';
import styles from './Modal.module.scss';

interface Props {
  title: string;
  onClose: () => void;
  children: ReactNode;
  initialFocusRef?: RefObject<HTMLElement | null>;
}

export function Modal({ title, onClose, children, initialFocusRef }: Props) {
  const { zIndex, raise, initialOffset } = useModalZIndex();
  const [offset, setOffset] = useState(initialOffset);
  const drag = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useModalA11y({ modalRef: panelRef, onClose, initialFocusRef });

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
    <div className={styles.overlay} style={{ zIndex }}>
      <div
        ref={panelRef}
        className={styles.panel}
        style={{ transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))`, zIndex }}
        onPointerDownCapture={raise}
        onFocusCapture={raise}
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
            <div />
            <div />
            <div />
          </div>
          <h2 id={titleId} className={styles.title}>{title}</h2>
          <div className="deco" aria-hidden="true">
            <div />
            <div />
            <div />
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
          {children}
        </div>
      </div>
    </div>
  );
}
