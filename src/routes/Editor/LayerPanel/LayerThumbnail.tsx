import { useEffect, useRef } from 'react';
import type { PixelLayer } from '@/types';
import styles from './LayerThumbnail.module.scss';

interface Props {
  layer: PixelLayer;
  width: number;
  height: number;
  size?: number;
}

export function LayerThumbnail({ layer, width, height, size = 32 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, width, height);
    ctx.globalAlpha = layer.opacity;

    for (const [key, color] of Object.entries(layer.pixels)) {
      const comma = key.indexOf(',');
      const x = parseInt(key.slice(0, comma), 10);
      const y = parseInt(key.slice(comma + 1), 10);
      ctx.fillStyle = color;
      ctx.fillRect(x, y, 1, 1);
    }

    ctx.globalAlpha = 1;
  }, [layer, width, height]);

  const ratio = width / height;
  const displayWidth = ratio >= 1 ? size : Math.round(size * ratio);
  const displayHeight = ratio >= 1 ? Math.round(size / ratio) : size;

  return (
    <div className={styles.wrap} style={{ width: size, height: size }} aria-hidden>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className={styles.canvas}
        style={{ width: displayWidth, height: displayHeight }}
      />
    </div>
  );
}
