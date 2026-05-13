import type { PixelLayer } from '@/types';

const TARGET_LONG_EDGE = 1920;

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

async function buildLayersPngBlob(
  layers: PixelLayer[],
  width: number,
  height: number,
): Promise<Blob> {
  const src = document.createElement('canvas');
  src.width = width;
  src.height = height;
  const sctx = src.getContext('2d');
  if (!sctx) throw new Error('Canvas 2D context unavailable');

  const img = sctx.createImageData(width, height);
  const buf = img.data;

  for (const layer of layers) {
    if (!layer.visible) continue;
    const srcA = layer.opacity;
    if (srcA <= 0) continue;
    for (const key in layer.pixels) {
      const c = layer.pixels[key];
      if (!c) continue;
      const commaIdx = key.indexOf(',');
      if (commaIdx === -1) continue;
      const x = Number(key.slice(0, commaIdx));
      const y = Number(key.slice(commaIdx + 1));
      if (x < 0 || y < 0 || x >= width || y >= height) continue;
      const [sr, sg, sb] = hexToRgb(c);
      const idx = (y * width + x) * 4;
      const dr = buf[idx] ?? 0;
      const dg = buf[idx + 1] ?? 0;
      const db = buf[idx + 2] ?? 0;
      const da = (buf[idx + 3] ?? 0) / 255;
      const outA = srcA + da * (1 - srcA);
      if (outA === 0) {
        buf[idx] = 0;
        buf[idx + 1] = 0;
        buf[idx + 2] = 0;
        buf[idx + 3] = 0;
      } else {
        buf[idx]     = Math.round((sr * srcA + dr * da * (1 - srcA)) / outA);
        buf[idx + 1] = Math.round((sg * srcA + dg * da * (1 - srcA)) / outA);
        buf[idx + 2] = Math.round((sb * srcA + db * da * (1 - srcA)) / outA);
        buf[idx + 3] = Math.round(outA * 255);
      }
    }
  }

  sctx.putImageData(img, 0, 0);

  const longEdge = Math.max(width, height);
  const scale = TARGET_LONG_EDGE / longEdge;
  const outW = Math.max(1, Math.round(width * scale));
  const outH = Math.max(1, Math.round(height * scale));

  const out = document.createElement('canvas');
  out.width = outW;
  out.height = outH;
  const octx = out.getContext('2d');
  if (!octx) throw new Error('Canvas 2D context unavailable');
  octx.imageSmoothingEnabled = false;
  octx.drawImage(src, 0, 0, outW, outH);

  return await new Promise<Blob>((resolve, reject) => {
    out.toBlob(b => {
      if (b) resolve(b);
      else reject(new Error('PNG encoding failed'));
    }, 'image/png');
  });
}

export async function copyLayersPng(
  layers: PixelLayer[],
  width: number,
  height: number,
): Promise<void> {
  const blobPromise = buildLayersPngBlob(layers, width, height);
  await navigator.clipboard.write([
    new ClipboardItem({ 'image/png': blobPromise }),
  ]);
}
