import { useCallback, useEffect, useRef, useState } from 'react';
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

const MAX_REF_IMAGE_BYTES = 5_000_000;
const MAX_REF_IMAGE_PIXELS = 25_000_000;
const ERROR_CLEAR_MS = 5000;

export function useReferenceImage({ canvasDisplaySize, activeLayerId, drawing, handleLayerChange, pushHistory, latestDataRef }: UseReferenceImageParams) {
  const [refImage, setRefImage] = useState<RefImageState | null>(null);
  const [refImageError, setRefImageError] = useState<string | null>(null);
  const errorTimerRef = useRef<number | null>(null);

  const reportError = useCallback((msg: string) => {
    setRefImageError(msg);
    if (errorTimerRef.current !== null) window.clearTimeout(errorTimerRef.current);
    errorTimerRef.current = window.setTimeout(() => {
      setRefImageError(null);
      errorTimerRef.current = null;
    }, ERROR_CLEAR_MS);
  }, []);

  const clearRefImageError = useCallback(() => {
    if (errorTimerRef.current !== null) {
      window.clearTimeout(errorTimerRef.current);
      errorTimerRef.current = null;
    }
    setRefImageError(null);
  }, []);

  useEffect(() => () => {
    if (errorTimerRef.current !== null) window.clearTimeout(errorTimerRef.current);
  }, []);

  const handleRefImageImport = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) {
      reportError('Format non supporté. Choisis une image (PNG, JPG, WebP…).');
      return;
    }
    if (file.size > MAX_REF_IMAGE_BYTES) {
      reportError(`Image trop lourde (${(file.size / 1_000_000).toFixed(1)} Mo). Limite : 5 Mo.`);
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reportError('Lecture du fichier impossible.');
    reader.onload = (e) => {
      const src = e.target?.result;
      if (typeof src !== 'string') {
        reportError('Lecture du fichier impossible.');
        return;
      }
      const img = new Image();
      img.onerror = () => reportError('Image corrompue ou illisible.');
      img.onload = () => {
        const pixels = img.naturalWidth * img.naturalHeight;
        if (pixels > MAX_REF_IMAGE_PIXELS) {
          reportError(`Image trop grande (${img.naturalWidth}×${img.naturalHeight}). Limite : 25 Mpx.`);
          return;
        }
        const canvasW = canvasDisplaySize.w || 256;
        const canvasH = canvasDisplaySize.h || 256;
        const initialScale = Math.min(canvasW / img.naturalWidth, canvasH / img.naturalHeight);
        clearRefImageError();
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
  }, [canvasDisplaySize, reportError, clearRefImageError]);

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

  return { refImage, refImageError, clearRefImageError, handleRefImageImport, handleRefImageRemove, handleRefImageTransform, handleCapturePixels };
}
