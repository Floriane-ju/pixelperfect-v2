import { useRef } from 'react';
import { useModalA11y } from '@/hooks/useModalA11y';
import { Button } from '@/components/Button';
import { Slider } from '@/components/Slider';
import styles from './SettingsPanel.module.scss';

export type EditorBgColor = 'white' | 'gray' | 'black';

export interface SettingsPanelProps {
  showGrid: boolean;
  gridOpacity: number;
  bgColor: EditorBgColor;
  onShowGridToggle: () => void;
  onGridOpacityChange: (value: number) => void;
  onBgColorChange: (color: EditorBgColor) => void;
  onClose: () => void;
}

const BG_OPTIONS: ReadonlyArray<{ value: EditorBgColor; label: string }> = [
  { value: 'white', label: 'Blanc' },
  { value: 'gray', label: 'Gris' },
  { value: 'black', label: 'Noir' },
];

export function SettingsPanel({
  showGrid,
  gridOpacity,
  bgColor,
  onShowGridToggle,
  onGridOpacityChange,
  onBgColorChange,
  onClose,
}: SettingsPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  useModalA11y({ modalRef: panelRef, onClose, closeOnEscape: true });

  const gridPercent = Math.round(gridOpacity * 100);

  return (
    <div
      ref={panelRef}
      className={styles.panel}
      role="dialog"
      aria-label="Paramètres d'affichage"
    >
      <section className={styles.section}>
        <div className={styles.row}>
          <span className={styles.label}>Afficher la grille</span>
          <Button
            variant={showGrid ? 'selected' : 'selectable'}
            size="sm"
            iconOnly
            iconLeft="grid"
            title="Afficher la grille"
            aria-label="Afficher la grille"
            aria-pressed={showGrid}
            onClick={onShowGridToggle}
          />
        </div>
        <Slider
          label="Grille de pixels"
          valueLabel={`${gridPercent} %`}
          min={0}
          max={100}
          step={1}
          value={gridPercent}
          onChange={v => onGridOpacityChange(v / 100)}
          ariaLabel="Visibilité de la grille de pixels"
          ariaValueText={`${gridPercent} pour cent`}
        />
      </section>

      <section className={styles.section}>
        <span className={styles.label}>Couleur de fond</span>
        <div className={styles.bgOptions} role="radiogroup" aria-label="Couleur de fond">
          {BG_OPTIONS.map(opt => (
            <Button
              key={opt.value}
              variant={bgColor === opt.value ? 'selected' : 'selectable'}
              size="sm"
              role="radio"
              aria-checked={bgColor === opt.value}
              aria-label={opt.label}
              onClick={() => onBgColorChange(opt.value)}
            >
              <span className={`${styles.swatch} ${styles[`swatch-${opt.value}`]}`} aria-hidden="true" />
            </Button>
          ))}
        </div>
      </section>
    </div>
  );
}
