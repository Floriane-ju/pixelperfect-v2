import { memo } from 'react';
import { cx } from '@/lib/cx';
import type { HexColor } from '@/types';
import styles from './ColorSwatch.module.scss';

export interface ColorSwatchProps {
  color: HexColor;
  /** Couleur réellement affichée pendant l'édition en cours (aperçu). */
  displayColor?: HexColor;
  isPreview?: boolean;
  onColorChange: (color: HexColor) => void;
  onEdit?: (color: HexColor, y: number) => void;
  onHoverEnter?: (color: HexColor) => void;
  onHoverLeave?: () => void;
}

export const ColorSwatch = memo(function ColorSwatch({
  color,
  displayColor,
  isPreview,
  onColorChange,
  onEdit,
  onHoverEnter,
  onHoverLeave,
}: ColorSwatchProps) {
  return (
    <button
      type="button"
      className={cx(styles.swatch, isPreview && styles.swatchPreview)}
      style={{ background: displayColor ?? color }}
      title={color}
      aria-label={`Choisir ${color}`}
      onClick={e => (onEdit ? onEdit(color, e.clientY) : onColorChange(color))}
      onPointerEnter={onHoverEnter ? () => onHoverEnter(color) : undefined}
      onPointerLeave={onHoverLeave}
    />
  );
});
