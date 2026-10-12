import type { PixelLayer } from '@/types';
import { Button } from '@/components/Button';
import { Slider } from '@/components/Slider';
import { LayerThumbnail } from '@/routes/Editor/LayerPanel/LayerThumbnail';
import styles from './Timeline.module.scss';

const MIN_FPS = 1;
const MAX_FPS = 24;
const THUMB_SIZE = 32;

export interface TimelineProps {
  /** Calques servant de frames, dans l'ordre de lecture. */
  frames: PixelLayer[];
  /** Frame affichée (lecture ou frame active en pause). */
  currentId: string | null;
  canvasWidth: number;
  canvasHeight: number;
  playing: boolean;
  fps: number;
  onPlayingToggle: () => void;
  onFrameSelect: (id: string) => void;
  onFpsChange: (fps: number) => void;
}

/** Bande de lecture : play/pause, frames (calques visibles) et vitesse. */
export function Timeline({
  frames,
  currentId,
  canvasWidth,
  canvasHeight,
  playing,
  fps,
  onPlayingToggle,
  onFrameSelect,
  onFpsChange,
}: TimelineProps) {
  return (
    <section className={styles.timeline} aria-label="Timeline d'animation">
      <Button
        variant={playing ? 'selected' : 'secondary'}
        iconOnly
        iconLeft={playing ? 'pause' : 'play'}
        aria-label={playing ? 'Pause' : 'Lire'}
        aria-pressed={playing}
        disabled={frames.length < 2}
        onClick={onPlayingToggle}
      />
      <ol className={styles.frames}>
        {frames.length === 0 && <li className={styles.empty}>Aucun calque visible</li>}
        {frames.map((layer, i) => (
          <li key={layer.id}>
            <Button
              variant={layer.id === currentId ? 'selected' : 'selectable'}
              size="sm"
              className={styles.frame}
              aria-label={`Frame ${i + 1} : ${layer.name}`}
              aria-current={layer.id === currentId ? 'true' : undefined}
              tooltip={false}
              onClick={() => onFrameSelect(layer.id)}
            >
              <LayerThumbnail layer={layer} width={canvasWidth} height={canvasHeight} size={THUMB_SIZE} />
              <span className={styles.number}>{i + 1}</span>
            </Button>
          </li>
        ))}
      </ol>
      <Slider
        className={styles.speed}
        valueLabel={`${fps} img/s`}
        min={MIN_FPS}
        max={MAX_FPS}
        value={fps}
        onChange={onFpsChange}
        ariaLabel="Vitesse de lecture"
        ariaValueText={`${fps} images par seconde`}
      />
    </section>
  );
}
