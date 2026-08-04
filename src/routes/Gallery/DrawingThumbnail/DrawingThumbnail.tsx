import { useEffect, useRef } from 'react';
import type { DrawingData } from '@/types';
import { tintFromRamp } from '@/lib/color';
import styles from './DrawingThumbnail.module.scss';

// Stops de --accent-2-* (cf. global.scss), du plus clair au plus sombre.
// On démarre à 400 : 300/350 sont trop pâles, le dessin ne ressortait pas du damier.
const RAMP_STOPS = [400, 450, 500, 550, 600, 650, 700, 750, 800] as const;

function readAccent2Ramp(): string[] {
  const root = getComputedStyle(document.documentElement);
  return RAMP_STOPS.map(stop => root.getPropertyValue(`--accent-2-${stop}`).trim()).filter(Boolean);
}

export interface DrawingThumbnailProps {
  data: DrawingData;
  size?: number;
}

export function DrawingThumbnail({ data, size = 120 }: DrawingThumbnailProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, data.width, data.height);

    const ramp = readAccent2Ramp();
    // Les dessins réutilisent peu de couleurs distinctes : on mémoïse le remap
    const tinted = new Map<string, string>();

    for (const layer of data.layers) {
      if (!layer.visible) continue;

      ctx.globalAlpha = layer.opacity;

      for (const [key, color] of Object.entries(layer.pixels)) {
        const comma = key.indexOf(',');
        const x = parseInt(key.slice(0, comma), 10);
        const y = parseInt(key.slice(comma + 1), 10);

        let fill = tinted.get(color);
        if (fill === undefined) {
          fill = tintFromRamp(color, ramp);
          tinted.set(color, fill);
        }

        ctx.fillStyle = fill;
        ctx.fillRect(x, y, 1, 1);
      }
    }

    ctx.globalAlpha = 1;
  }, [data]);

  const ratio = data.width / data.height;
  const displayWidth = ratio >= 1 ? size : Math.round(size * ratio);
  const displayHeight = ratio >= 1 ? Math.round(size / ratio) : size;

  return (
    <canvas
      ref={canvasRef}
      width={data.width}
      height={data.height}
      className={styles.canvas}
      style={{ width: displayWidth, height: displayHeight }}
      aria-hidden
    />
  );
}
