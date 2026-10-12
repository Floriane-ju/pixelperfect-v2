import { useId, useRef } from 'react';
import { useModalA11y } from '@/hooks/useModalA11y';
import { cx } from '@/lib/cx';
import { Button } from '@/components/Button';
import { Slider } from '@/components/Slider';
import { Switch } from '@/components/Switch';
import styles from './SettingsPanel.module.scss';

export type EditorBgColor = 'white' | 'gray' | 'black';

export interface SettingsPanelProps {
  showGrid: boolean;
  gridOpacity: number;
  bgColor: EditorBgColor;
  onShowGridToggle: () => void;
  onGridOpacityChange: (value: number) => void;
  onBgColorChange: (color: EditorBgColor) => void;
  animationMode: boolean;
  onAnimationModeToggle: () => void;
  onionSkin: boolean;
  onOnionSkinToggle: () => void;
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
  animationMode,
  onAnimationModeToggle,
  onionSkin,
  onOnionSkinToggle,
  onClose,
}: SettingsPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  useModalA11y({ modalRef: panelRef, onClose, closeOnEscape: true });

  const gridLabelId = useId();
  const animationLabelId = useId();
  const onionLabelId = useId();
  const gridPercent = Math.round(gridOpacity * 100);

  return (
    <div
      ref={panelRef}
      className={styles.panel}
      role="dialog"
      aria-label="Paramètres d'affichage"
    >
      <h2 className={styles.title}>Affichage</h2>
      <section className={styles.section}>
        <div className={styles.row}>
          <span className={styles.label} id={gridLabelId}>Afficher la grille</span>
          <Switch checked={showGrid} onChange={onShowGridToggle} aria-labelledby={gridLabelId} />
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
        <div className={styles.options} role="radiogroup" aria-label="Couleur de fond">
          {BG_OPTIONS.map(opt => (
            <Button
              key={opt.value}
              variant={bgColor === opt.value ? 'selected' : 'selectable'}
              size="sm"
              role="radio"
              aria-checked={bgColor === opt.value}
              onClick={() => onBgColorChange(opt.value)}
            >
              <span className={cx(styles.swatch, styles[`swatch-${opt.value}`])} aria-hidden="true" />
              {opt.label}
            </Button>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.row}>
          <span className={styles.label} id={animationLabelId}>Mode animation</span>
          <Switch checked={animationMode} onChange={onAnimationModeToggle} aria-labelledby={animationLabelId} />
        </div>
        {animationMode && (
          <div className={styles.row}>
            <span className={styles.label} id={onionLabelId}>Pelure d'oignon</span>
            <Switch checked={onionSkin} onChange={onOnionSkinToggle} aria-labelledby={onionLabelId} />
          </div>
        )}
      </section>
    </div>
  );
}
