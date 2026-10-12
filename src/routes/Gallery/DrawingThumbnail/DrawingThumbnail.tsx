import { memo, useEffect, useRef, type CSSProperties } from 'react';
import type { DrawingRow } from '@/types';
import styles from './DrawingThumbnail.module.scss';

export interface DrawingThumbnailProps {
  drawing: Pick<DrawingRow, 'id' | 'updated_at' | 'data'>;
}

// Les rafraîchissements de galerie recréent les objets `data` : la vignette ne se redessine que si
// le dessin a changé (autre id ou autre date de mise à jour).
function isSameRevision(prev: DrawingThumbnailProps, next: DrawingThumbnailProps): boolean {
  return prev.drawing.data === next.drawing.data
    || (prev.drawing.id === next.drawing.id && prev.drawing.updated_at === next.drawing.updated_at);
}

export const DrawingThumbnail = memo(function DrawingThumbnail({ drawing }: DrawingThumbnailProps) {
  const { data } = drawing;
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, data.width, data.height);

    for (const layer of data.layers) {
      if (!layer.visible) continue;

      ctx.globalAlpha = layer.opacity;

      for (const [key, color] of Object.entries(layer.pixels)) {
        const comma = key.indexOf(',');
        const x = parseInt(key.slice(0, comma), 10);
        const y = parseInt(key.slice(comma + 1), 10);

        ctx.fillStyle = color;
        ctx.fillRect(x, y, 1, 1);
      }
    }

    ctx.globalAlpha = 1;
  }, [data]);

  // La taille vient du parent : `--ratio` laisse le CSS contenir le dessin
  // dans le carré disponible sans le déformer (cf. DrawingThumbnail.module.scss).
  const ratio = data.width / data.height;

  return (
    <canvas
      ref={canvasRef}
      width={data.width}
      height={data.height}
      className={styles.canvas}
      style={{ '--ratio': ratio } as CSSProperties}
      aria-hidden
    />
  );
}, isSameRevision);
