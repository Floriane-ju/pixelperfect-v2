import type { ReactNode, Ref } from 'react';
import { ColorSwatch } from '@/components/ColorSwatch';
import { ColorWheelIcon } from '@/components/ColorWheelIcon';
import type { HexColor } from '@/types';
import styles from './ColorRail.module.scss';

export interface ColorRailProps {
  color: HexColor;
  recentColors: HexColor[];
  drawingColors: HexColor[];
  /** Couleur d'origine en cours d'édition (aperçu de la nouvelle teinte sur sa pastille). */
  editingColor?: HexColor;
  /** La première récente est la couleur courante (choix normal, pas une édition). */
  highlightFirstRecent: boolean;
  pickerOpen: boolean;
  onPickerToggle: () => void;
  /** Sélecteur ancré au rail, rendu quand `pickerOpen`. */
  picker?: ReactNode;
  onColorChange: (color: HexColor) => void;
  onEditDrawingColor: (color: HexColor, y: number) => void;
  onHoverEnter: (color: HexColor) => void;
  onHoverLeave: () => void;
  ref?: Ref<HTMLElement>;
}

/** Rail encre des couleurs, à droite de l'éditeur : couleur active, récentes, couleurs du dessin. */
export function ColorRail({
  color, recentColors, drawingColors, editingColor, highlightFirstRecent,
  pickerOpen, onPickerToggle, picker,
  onColorChange, onEditDrawingColor, onHoverEnter, onHoverLeave, ref,
}: ColorRailProps) {
  return (
    <aside ref={ref} className={styles.rail} aria-label="Couleurs">
      <span className={styles.current} style={{ background: color }} aria-hidden="true" />
      <span className={styles.hex}>{color.toUpperCase()}</span>
      <div className={styles.pickerSlot}>
        <button
          type="button"
          className={styles.pickerTrigger}
          title="Choisir une couleur"
          aria-label="Choisir une couleur"
          aria-expanded={pickerOpen}
          onClick={onPickerToggle}
        >
          <ColorWheelIcon size={24} />
        </button>
        {picker}
      </div>

      {recentColors.length > 0 && (
        <>
          <span className={styles.divider} aria-hidden="true" />
          <span className={styles.heading} aria-hidden="true">Récent</span>
          <div className={styles.swatches} role="group" aria-label="Couleurs récentes">
            {recentColors.map((c, i) => (
              <ColorSwatch
                key={c}
                color={c}
                isPreview={highlightFirstRecent && i === 0}
                onColorChange={onColorChange}
              />
            ))}
          </div>
        </>
      )}

      {drawingColors.length > 0 && (
        <>
          <span className={styles.divider} aria-hidden="true" />
          <span className={styles.heading} aria-hidden="true">Dessin</span>
          <div className={styles.swatchesScroll} role="group" aria-label="Couleurs du dessin">
            {drawingColors.map((c) => (
              <ColorSwatch
                key={c}
                color={c}
                displayColor={editingColor === c ? color : undefined}
                onColorChange={onColorChange}
                onEdit={onEditDrawingColor}
                onHoverEnter={onHoverEnter}
                onHoverLeave={onHoverLeave}
              />
            ))}
          </div>
        </>
      )}
    </aside>
  );
}
