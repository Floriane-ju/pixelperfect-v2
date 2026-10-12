import { useRef } from 'react';
import type { MouseEvent } from 'react';
import { Button } from '@/components/Button';
import { useOutsideDismiss } from '@/hooks/useOutsideDismiss';
import { useLongPress } from '../hooks/useLongPress';
import type { Tool } from '../Canvas/Canvas';
import type { ToolDef } from '../tools';
import { BrushSizePopover } from './BrushSizePopover';
import styles from './ToolDock.module.scss';

export interface ToolButtonProps {
  def: ToolDef;
  active: boolean;
  brushSize: number;
  sizeOpen: boolean;
  onSelect: (tool: Tool) => void;
  onSizeOpenChange: (open: boolean) => void;
  onBrushSizeChange: (size: number) => void;
}

/**
 * Outil du dock. Crayon et gomme portent la taille du pinceau : badge, et popover de taille
 * ouvert par appui long, clic droit, ou nouveau clic (Entrée) sur l'outil déjà actif.
 */
export function ToolButton({ def, active, brushSize, sizeOpen, onSelect, onSizeOpenChange, onBrushSizeChange }: ToolButtonProps) {
  const slotRef = useRef<HTMLDivElement>(null);
  const sized = def.sized === true;

  const openSize = () => {
    onSelect(def.tool);
    onSizeOpenChange(true);
  };
  const { holding, handlers, consumeFired } = useLongPress({ onLongPress: openSize, enabled: sized });

  useOutsideDismiss({
    active: sizeOpen,
    refs: [slotRef],
    onDismiss: () => onSizeOpenChange(false),
    closeOnEscape: true,
  });

  const handleClick = () => {
    if (consumeFired()) return;
    if (sized && active) {
      onSizeOpenChange(!sizeOpen);
      return;
    }
    onSelect(def.tool);
  };

  const handleContextMenu = (e: MouseEvent<HTMLButtonElement>) => {
    if (!sized) return;
    e.preventDefault();
    openSize();
  };

  return (
    <div ref={slotRef} className={styles.slot}>
      <Button
        variant="ink"
        iconOnly
        iconLeft={def.icon}
        aria-label={def.label}
        title={def.title ?? def.label}
        aria-pressed={active}
        aria-haspopup={sized ? 'dialog' : undefined}
        longPressLabel={!sized}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        {...handlers}
      />
      {sized && (
        <span className={styles.badge} aria-hidden="true">{brushSize}</span>
      )}
      {holding && <span className={styles.holdBar} aria-hidden="true" />}
      {sized && sizeOpen && (
        <BrushSizePopover
          toolLabel={def.label}
          size={brushSize}
          onSizeChange={onBrushSizeChange}
          onClose={() => onSizeOpenChange(false)}
        />
      )}
    </div>
  );
}
