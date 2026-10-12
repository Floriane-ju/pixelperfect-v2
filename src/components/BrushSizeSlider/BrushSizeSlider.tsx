import { Button } from '@/components/Button';
import { Slider } from '@/components/Slider';
import styles from './BrushSizeSlider.module.scss';

export interface BrushSizeSliderProps {
  value: number;
  min?: number;
  max?: number;
  onChange: (value: number) => void;
  ariaLabel?: string;
  /** Tailles proposées en accès rapide. */
  presets?: readonly number[];
}

const DEFAULT_PRESETS = [1, 2, 4, 8, 16] as const;
/** Côté maximal (px) de l'aperçu du pinceau dans sa vignette de 80 px. */
const PREVIEW_MAX = 64;

/** Réglage de la taille du pinceau : aperçu, valeur, curseur et tailles rapides. */
export function BrushSizeSlider({
  value,
  min = 1,
  max = 16,
  onChange,
  ariaLabel = 'Taille du pinceau',
  presets = DEFAULT_PRESETS,
}: BrushSizeSliderProps) {
  const previewSide = Math.round((value / max) * PREVIEW_MAX);

  return (
    <div className={styles.wrapper}>
      <div className={styles.summary}>
        <span className={styles.preview} aria-hidden="true">
          <span className={styles.previewDot} style={{ width: previewSide, height: previewSide }} />
        </span>
        <div className={styles.readout}>
          <span className={styles.value} aria-hidden="true">
            {value}
            <span className={styles.unit}>px</span>
          </span>
          <span className={styles.hint}>Commune au crayon et à la gomme</span>
        </div>
      </div>
      <div className={styles.range}>
        <Slider
          value={value}
          min={min}
          max={max}
          onChange={onChange}
          ariaLabel={ariaLabel}
          ariaValueText={`${value} pixel${value > 1 ? 's' : ''}`}
        />
        <span className={styles.bounds} aria-hidden="true">
          <span>{min}</span>
          <span>{max}</span>
        </span>
      </div>
      <div className={styles.presets} role="group" aria-label="Tailles rapides">
        {presets.map((n) => (
          <Button
            key={n}
            variant={n === value ? 'selected' : 'selectable'}
            size="sm"
            aria-pressed={n === value}
            aria-label={`${n} px`}
            onClick={() => onChange(n)}
          >
            {n}
          </Button>
        ))}
      </div>
    </div>
  );
}
