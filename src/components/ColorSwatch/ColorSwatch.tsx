import React from 'react';
import styles from './ColorSwatch.module.scss';

interface ColorSwatchProps {
  color: string;
  displayColor?: string;
  isPreview?: boolean;
  onColorChange: (color: string) => void;
  onContextMenu?: (color: string, x: number, y: number) => void;
  onHoverEnter?: (color: string) => void;
  onHoverLeave?: () => void;
}

export const ColorSwatch = React.memo(function ColorSwatch({
  color,
  displayColor,
  isPreview,
  onColorChange,
  onContextMenu,
  onHoverEnter,
  onHoverLeave,
}: ColorSwatchProps) {
  return (
    <button
      className={`${styles.colorSwatch}${isPreview ? ` ${styles.colorSwatchPreview}` : ''}`}
      style={{ background: displayColor ?? color }}
      title={color}
      aria-label={`Choisir ${color}`}
      onClick={() => onColorChange(color)}
      onContextMenu={onContextMenu ? e => { e.preventDefault(); onContextMenu(color, e.clientX, e.clientY); } : undefined}
      onPointerEnter={onHoverEnter ? () => onHoverEnter(color) : undefined}
      onPointerLeave={onHoverLeave}
    />
  );
});
