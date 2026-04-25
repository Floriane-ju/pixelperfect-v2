import { useEffect, useRef } from 'react';
import type { DrawingData } from '@/types';
import styles from './DrawingThumbnail.module.scss';

interface Props {
  data: DrawingData;
  size?: number;
}

export function DrawingThumbnail({ data, size = 120 }: Props) {
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

  return (
    <canvas
      ref={canvasRef}
      width={data.width}
      height={data.height}
      className={styles.canvas}
      style={{ width: size, height: size }}
      aria-hidden
    />
  );
}
