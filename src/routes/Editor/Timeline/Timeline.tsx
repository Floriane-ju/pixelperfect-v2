import type { KeyboardEvent } from 'react';
import type { PixelLayer } from '@/types';
import { Button } from '@/components/Button';
import { Icons } from '@/components/Icons';
import { cx } from '@/lib/cx';
import { useDragReorder } from '@/routes/Editor/hooks/useDragReorder';
import { LayerThumbnail } from '@/routes/Editor/LayerPanel/LayerThumbnail';
import styles from './Timeline.module.scss';

const THUMB_SIZE = 32;
const noReorder = () => {};

export interface TimelineEditProps {
  onFrameReorder: (fromId: string, toId: string, position: 'before' | 'after') => void;
  /** Plafond de calques atteint : ajout et duplication désactivés. */
  atLayerCap: boolean;
  /** Faux s'il ne reste qu'un calque. */
  canDelete: boolean;
  /** Visibilité du calque sélectionné (masqué = plus une frame). */
  selectedVisible: boolean;
  onFrameAdd: () => void;
  /** Masque, duplique ou supprime le calque sélectionné. */
  onFrameVisibilityToggle: () => void;
  onFrameDuplicate: () => void;
  onFrameDelete: () => void;
}

export interface TimelineProps {
  /** Tous les calques, dans l'ordre de lecture ; les masqués sont sautés à la lecture. */
  frames: PixelLayer[];
  /** Frame affichée (lecture ou frame active en pause). */
  currentId: string | null;
  canvasWidth: number;
  canvasHeight: number;
  playing: boolean;
  onPlayingToggle: () => void;
  onFrameSelect: (id: string) => void;
  /** Absent : lecture seule (lien public), sans réordonnancement ni actions sur les calques. */
  edit?: TimelineEditProps;
}

/** Bande de lecture : play/pause, frames (calques) et actions sur le calque sélectionné. */
export function Timeline({
  frames,
  currentId,
  canvasWidth,
  canvasHeight,
  playing,
  onPlayingToggle,
  onFrameSelect,
  edit,
}: TimelineProps) {
  const onFrameReorder = edit?.onFrameReorder ?? noReorder;
  // Frames dans l'ordre de `layers` : « avant » à l'écran = « avant » dans les calques.
  const { drag, setItemRef, handleProps } = useDragReorder<HTMLLIElement>({ axis: 'x', onDrop: onFrameReorder });

  /** Alt + ←/→ : déplace la frame d'un cran, pendant clavier du glisser-déposer. */
  const handleFrameKeyDown = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (!edit || !e.altKey || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')) return;
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
        disabled={frames.filter(l => l.visible).length < 2}
        onClick={onPlayingToggle}
      />
      <ol className={styles.frames}>
        {frames.map((layer, i) => (
          <li
            key={layer.id}
            ref={setItemRef(layer.id)}
            className={cx(
              styles.item,
              !layer.visible && styles.itemHidden,
              drag?.id === layer.id && styles.itemDragging,
              drag?.targetId === layer.id && (drag.pos === 'before' ? styles.itemDropBefore : styles.itemDropAfter),
            )}
          >
            <Button
              variant={layer.id === currentId ? 'selected' : 'selectable'}
              size="sm"
              className={styles.frame}
              aria-label={`Frame ${i + 1} : ${layer.name}${layer.visible ? '' : ' (masqué)'}`}
              aria-keyshortcuts={edit ? 'Alt+ArrowLeft Alt+ArrowRight' : undefined}
              aria-current={layer.id === currentId ? 'true' : undefined}
              tooltip={false}
              onClick={() => onFrameSelect(layer.id)}
              onKeyDown={e => handleFrameKeyDown(e, i)}
            >
              {edit && (
                <span className={styles.handle} aria-hidden="true" {...handleProps(layer.id)}>
                  <Icons icon="drag" size={16} />
                </span>
              )}
              <LayerThumbnail layer={layer} width={canvasWidth} height={canvasHeight} size={THUMB_SIZE} />
            </Button>
          </li>
        ))}
      </ol>
      {edit && (
        <>
          <div className={styles.actions}>
            {/* En lecture, la frame affichée n'est pas le calque sélectionné : on évite l'ambiguïté. */}
            <Button
              variant="ghost"
              iconOnly
              iconLeft={edit.selectedVisible ? 'eye' : 'eye-off'}
              aria-label={edit.selectedVisible ? 'Masquer le calque sélectionné' : 'Afficher le calque sélectionné'}
              disabled={playing}
              onClick={edit.onFrameVisibilityToggle}
            />
            <Button
              variant="ghost"
              iconOnly
              iconLeft="duplicate"
              aria-label="Dupliquer le calque sélectionné"
              disabled={edit.atLayerCap || playing}
              onClick={edit.onFrameDuplicate}
            />
            <Button
              variant="ghost"
              iconOnly
              iconLeft="trash"
              aria-label="Supprimer le calque sélectionné"
              disabled={!edit.canDelete || playing}
              onClick={edit.onFrameDelete}
            />
          </div>
          <span className={styles.separator} aria-hidden="true" />
          <Button
            variant="ghost"
            iconOnly
            iconLeft="add"
            aria-label="Nouveau calque"
            disabled={edit.atLayerCap}
            onClick={edit.onFrameAdd}
          />
        </>
      )}
    </section>
  );
}
