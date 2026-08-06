import { useRef } from 'react';
import type { CSSProperties, ReactNode, RefObject } from 'react';
import { useModalA11y } from '@/hooks/useModalA11y';

interface ColorPanelProps {
  children: ReactNode;
  onClose: () => void;
  className?: string;
  style?: CSSProperties;
  panelRef?: RefObject<HTMLDivElement | null>;
}

export function ColorPanel({ children, onClose, className, style, panelRef }: ColorPanelProps) {
  const localRef = useRef<HTMLDivElement>(null);
  const ref = panelRef ?? localRef;
  useModalA11y({ modalRef: ref, onClose, closeOnEscape: false });
  return (
    <div ref={ref} className={className} style={style}>
      {children}
    </div>
  );
}
