import { useCallback, useState } from 'react';
import type { DrawingData, DrawingRow, HexColor } from '@/types';
import { mergeColors } from '../colorMerge';

export interface RefImageState {
  src: string;
  x: number;
  y: number;
  scale: number;
  opacity: number;
  naturalWidth: number;
  naturalHeight: number;
}

interface UseReferenceImageParams {
  canvasDisplaySize: { w: number; h: number };
  activeLayerId: string;
  drawing: DrawingRow | null;
  handleLayerChange: (layerId: string, pixels: Record<string, HexColor>) => void;
  pushHistory: (before: DrawingData) => void;
  latestDataRef: React.MutableRefObject<DrawingData | null>;
}

export function useReferenceImage({ canvasDisplaySize, activeLayerId, drawing, handleLayerChange, pushHistory, latestDataRef }: UseReferenceImageParams) {
  const [refImage, setRefImage] = useState<RefImageState | null>(null);

  const handleRefImageImport = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) {
      console.error('Ref image import rejected: not an image type', file.type);
      return;
    }
    if (file.size > 5_000_000) {
      console.error('Ref image import rejected: file too large', file.size);
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const src = e.target?.result as string;
      const img = new Image();
      img.onload = () => {
        const canvasW = canvasDisplaySize.w || 256;
        const canvasH = canvasDisplaySize.h || 256;
        const initialScale = Math.min(canvasW / img.naturalWidth, canvasH / img.naturalHeight);
        setRefImage({
          src,
          x: (canvasW - img.naturalWidth * initialScale) / 2,
          y: (canvasH - img.naturalHeight * initialScale) / 2,
          scale: initialScale,
          opacity: 0.65,
          naturalWidth: img.naturalWidth,
          naturalHeight: img.naturalHeight,
        });
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
  }, [canvasDisplaySize]);

  const handleRefImageRemove = useCallback(() => setRefImage(null), []);

  const handleRefImageTransform = useCallback((x: number, y: number, scale: number, opacity: number) => {
    setRefImage(prev => prev ? { ...prev, x, y, scale, opacity } : prev);
  }, []);

  const handleCapturePixels = useCallback(() => {
    if (!refImage || !drawing) return;
    const offscreen = document.createElement('canvas');
    offscreen.width = refImage.naturalWidth;
    offscreen.height = refImage.naturalHeight;
    const ctx = offscreen.getContext('2d');
    if (!ctx) return;
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 0, 0);
      const { data: imgData } = ctx.getImageData(0, 0, refImage.naturalWidth, refImage.naturalHeight);
      const { width, height } = drawing.data;
      const dw = canvasDisplaySize.w;
      const dh = canvasDisplaySize.h;
      const imgDisplayW = refImage.naturalWidth * refImage.scale;
      const imgDisplayH = refImage.naturalHeight * refImage.scale;
      const newPixels: Record<string, HexColor> = {};
      for (let cy = 0; cy < height; cy++) {
        for (let cx = 0; cx < width; cx++) {
          const displayX = (cx + 0.5) * (dw / width);
          const displayY = (cy + 0.5) * (dh / height);
          if (displayX < refImage.x || displayX >= refImage.x + imgDisplayW ||
            displayY < refImage.y || displayY >= refImage.y + imgDisplayH) continue;
          const imgX = Math.min(Math.floor((displayX - refImage.x) / refImage.scale), refImage.naturalWidth - 1);
          const imgY = Math.min(Math.floor((displayY - refImage.y) / refImage.scale), refImage.naturalHeight - 1);
          const i = (imgY * refImage.naturalWidth + imgX) * 4;
          if ((imgData[i + 3] ?? 0) < 10) continue;
          const r = (imgData[i] ?? 0).toString(16).padStart(2, '0');
          const g = (imgData[i + 1] ?? 0).toString(16).padStart(2, '0');
          const b = (imgData[i + 2] ?? 0).toString(16).padStart(2, '0');
          newPixels[`${cx},${cy}`] = `#${r}${g}${b}` as HexColor;
        }
      }
      if (latestDataRef.current) pushHistory(latestDataRef.current);
      handleLayerChange(activeLayerId, mergeColors(newPixels));
    };
    img.src = refImage.src;
  }, [refImage, drawing, canvasDisplaySize, activeLayerId, handleLayerChange, pushHistory, latestDataRef]);

  return { refImage, handleRefImageImport, handleRefImageRemove, handleRefImageTransform, handleCapturePixels };
}
