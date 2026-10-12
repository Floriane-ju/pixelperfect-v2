import type { KeyboardEvent } from 'react';
import type { PixelLayer } from '@/types';
import { Button } from '@/components/Button';
import { Icons } from '@/components/Icons';
import { Slider } from '@/components/Slider';
import { cx } from '@/lib/cx';
import { useDragReorder } from '@/routes/Editor/hooks/useDragReorder';
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
  onFrameReorder: (fromId: string, toId: string, position: 'before' | 'after') => void;
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
  onFrameReorder,
}: TimelineProps) {
  // Frames dans l'ordre de `layers` : « avant » à l'écran = « avant » dans les calques.
  const { drag, setItemRef, handleProps } = useDragReorder<HTMLLIElement>({ axis: 'x', onDrop: onFrameReorder });

  /** Alt + ←/→ : déplace la frame d'un cran, pendant clavier du glisser-déposer. */
  const handleFrameKeyDown = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (!e.altKey || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')) return;
    const delta = e.key === 'ArrowLeft' ? -1 : 1;
    const frame = frames[index];
    const target = frames[index + delta];
    if (!frame || !target) return;
    e.preventDefault();
    onFrameReorder(frame.id, target.id, delta === -1 ? 'before' : 'after');
  };

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
          <li
            key={layer.id}
            ref={setItemRef(layer.id)}
            className={cx(
              styles.item,
              drag?.id === layer.id && styles.itemDragging,
              drag?.targetId === layer.id && (drag.pos === 'before' ? styles.itemDropBefore : styles.itemDropAfter),
            )}
          >
            <Button
              variant={layer.id === currentId ? 'selected' : 'selectable'}
              size="sm"
              className={styles.frame}
              aria-label={`Frame ${i + 1} : ${layer.name}`}
              aria-keyshortcuts="Alt+ArrowLeft Alt+ArrowRight"
              aria-current={layer.id === currentId ? 'true' : undefined}
              tooltip={false}
              onClick={() => onFrameSelect(layer.id)}
              onKeyDown={e => handleFrameKeyDown(e, i)}
            >
              <span className={styles.handle} aria-hidden="true" {...handleProps(layer.id)}>
                <Icons icon="drag" size={16} />
              </span>
              <LayerThumbnail layer={layer} width={canvasWidth} height={canvasHeight} size={THUMB_SIZE} />
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
