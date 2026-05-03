import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { fetchDrawing, updateDrawingData } from '@/lib/drawings';
import type { DrawingData, DrawingRow, HexColor, PixelLayer } from '@/types';
import { Button } from '@/components/Button';
import { Canvas } from './Canvas';
import type { Tool } from './Canvas';
import { mergeColors } from './colorMerge';
import { Topbar } from './Topbar';
import styles from './Editor.module.scss';

interface RefImageState {
  src: string;
  x: number;
  y: number;
  scale: number;
  opacity: number;
  naturalWidth: number;
  naturalHeight: number;
}
type OpenPanel = 'layers' | 'color' | 'ref' | null;
type Status = 'loading' | 'ready' | 'error' | 'saving';

const SAVE_DELAY = 1500;
const MAX_HISTORY = 50;

export function Editor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [drawing, setDrawing] = useState<DrawingRow | null>(null);
  const [status, setStatus] = useState<Status>('loading');
  const [tool, setTool] = useState<Tool>('pencil');
  const [activeLayerId, setActiveLayerId] = useState<string>('');
  const [color, setColor] = useState<HexColor>('#000000');
  const [recentColors, setRecentColors] = useState<HexColor[]>([]);
  const [openPanel, setOpenPanel] = useState<OpenPanel>(null);
  const [showInvisibleModal, setShowInvisibleModal] = useState(false);
  const [mirrorH, setMirrorH] = useState(false);
  const [mirrorV, setMirrorV] = useState(false);
  const [hoveredColor, setHoveredColor] = useState<HexColor | null>(null);

  const [refImage, setRefImage] = useState<RefImageState | null>(null);
  const [canvasDisplaySize, setCanvasDisplaySize] = useState({ w: 256, h: 256 });
  const canvasAreaRef = useRef<HTMLDivElement>(null);

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestDataRef = useRef<DrawingData | null>(null);

  const pastRef = useRef<DrawingData[]>([]);
  const futureRef = useRef<DrawingData[]>([]);
  const strokeSnapshotRef = useRef<DrawingData | null>(null);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  // Keep latestDataRef in sync for flush-on-unmount
  useEffect(() => {
    if (drawing) latestDataRef.current = drawing.data;
  }, [drawing]);

  // Load drawing
  useEffect(() => {
    if (!id) return;
    setStatus('loading');
    fetchDrawing(id)
      .then(row => {
        setDrawing(row);
        const visibleLayers = row.data.layers.filter(l => l.visible);
        const topmost = visibleLayers[visibleLayers.length - 1] ?? row.data.layers[row.data.layers.length - 1];
        setActiveLayerId(topmost?.id ?? '');
        setStatus('ready');
      })
      .catch(() => setStatus('error'));
  }, [id]);

  // Flush pending save on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current !== null && latestDataRef.current && id) {
        clearTimeout(saveTimerRef.current);
        void updateDrawingData(id, latestDataRef.current);
      }
    };
  }, [id]);

  const scheduleSave = useCallback(() => {
    if (!id) return;
    if (saveTimerRef.current !== null) clearTimeout(saveTimerRef.current);
    setStatus('saving');
    saveTimerRef.current = setTimeout(async () => {
      saveTimerRef.current = null;
      if (!latestDataRef.current) return;
      try {
        await updateDrawingData(id, latestDataRef.current);
        setStatus('ready');
      } catch {
        setStatus('error');
      }
    }, SAVE_DELAY);
  }, [id]);

  const syncHistoryFlags = useCallback(() => {
    setCanUndo(pastRef.current.length > 0);
    setCanRedo(futureRef.current.length > 0);
  }, []);

  const pushHistory = useCallback((before: DrawingData) => {
    const past = pastRef.current;
    pastRef.current = past.length >= MAX_HISTORY ? [...past.slice(1), before] : [...past, before];
    futureRef.current = [];
    syncHistoryFlags();
  }, [syncHistoryFlags]);

  const handleDrawStart = useCallback(() => {
    strokeSnapshotRef.current = latestDataRef.current;
  }, []);

  const handleDrawEnd = useCallback(() => {
    if (strokeSnapshotRef.current) {
      pushHistory(strokeSnapshotRef.current);
      strokeSnapshotRef.current = null;
    }
  }, [pushHistory]);

  const handleUndo = useCallback(() => {
    const past = pastRef.current;
    if (past.length === 0) return;
    const before = past[past.length - 1];
    pastRef.current = past.slice(0, -1);
    const current = latestDataRef.current;
    if (current) futureRef.current = [...futureRef.current, current];
    setDrawing(prev => prev ? { ...prev, data: before } : prev);
    scheduleSave();
    syncHistoryFlags();
  }, [scheduleSave, syncHistoryFlags]);

  const handleRedo = useCallback(() => {
    const future = futureRef.current;
    if (future.length === 0) return;
    const after = future[future.length - 1];
    futureRef.current = future.slice(0, -1);
    const current = latestDataRef.current;
    if (current) pastRef.current = [...pastRef.current, current];
    setDrawing(prev => prev ? { ...prev, data: after } : prev);
    scheduleSave();
    syncHistoryFlags();
  }, [scheduleSave, syncHistoryFlags]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      } else if (
        ((e.ctrlKey || e.metaKey) && e.key === 'y') ||
        ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'z')
      ) {
        e.preventDefault();
        handleRedo();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [handleUndo, handleRedo]);

  // Layer handlers
  const handleLayerChange = useCallback(
    (layerId: string, pixels: Record<string, HexColor>) => {
      setDrawing(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          data: {
            ...prev.data,
            layers: prev.data.layers.map(l => l.id === layerId ? { ...l, pixels } : l),
          },
        };
      });
      scheduleSave();
    },
    [scheduleSave]
  );

  const handleLayerVisibilityToggle = useCallback((layerId: string) => {
    if (latestDataRef.current) pushHistory(latestDataRef.current);
    setDrawing(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        data: {
          ...prev.data,
          layers: prev.data.layers.map(l => l.id === layerId ? { ...l, visible: !l.visible } : l),
        },
      };
    });
    scheduleSave();
  }, [scheduleSave, pushHistory]);

  const handleLayerDuplicate = useCallback((layerId: string) => {
    if (latestDataRef.current) pushHistory(latestDataRef.current);
    setDrawing(prev => {
      if (!prev) return prev;
      const src = prev.data.layers.find(l => l.id === layerId);
      if (!src) return prev;
      const clone: PixelLayer = {
        ...src,
        id: crypto.randomUUID(),
        name: `${src.name} copie`,
        pixels: { ...src.pixels },
      };
      const idx = prev.data.layers.findIndex(l => l.id === layerId);
      const layers = [
        ...prev.data.layers.slice(0, idx + 1),
        clone,
        ...prev.data.layers.slice(idx + 1),
      ];
      return { ...prev, data: { ...prev.data, layers } };
    });
    scheduleSave();
  }, [scheduleSave]);

  const handleLayerAdd = useCallback(() => {
    if (latestDataRef.current) pushHistory(latestDataRef.current);
    setDrawing(prev => {
      if (!prev) return prev;
      const newLayer: PixelLayer = {
        id: crypto.randomUUID(),
        name: `Calque ${prev.data.layers.length + 1}`,
        pixels: {},
        opacity: 1,
        visible: true,
      };
      const activeIdx = prev.data.layers.findIndex(l => l.id === activeLayerId);
      const insertAt = activeIdx >= 0 ? activeIdx + 1 : prev.data.layers.length;
      const layers = [
        ...prev.data.layers.slice(0, insertAt),
        newLayer,
        ...prev.data.layers.slice(insertAt),
      ];
      setActiveLayerId(newLayer.id);
      return { ...prev, data: { ...prev.data, layers } };
    });
    scheduleSave();
  }, [activeLayerId, scheduleSave, pushHistory]);

  const handleLayerDelete = useCallback((layerId: string) => {
    if (latestDataRef.current) pushHistory(latestDataRef.current);
    setDrawing(prev => {
      if (!prev || prev.data.layers.length <= 1) return prev;
      const layers = prev.data.layers.filter(l => l.id !== layerId);
      return { ...prev, data: { ...prev.data, layers } };
    });
    setActiveLayerId(prev => {
      if (prev !== layerId) return prev;
      const remaining = drawing?.data.layers.filter(l => l.id !== layerId) ?? [];
      return remaining[0]?.id ?? '';
    });
    scheduleSave();
  }, [scheduleSave, drawing, pushHistory]);

  const handleRefImageImport = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const src = e.target?.result as string;
      const img = new Image();
      img.onload = () => {
        const canvasW = canvasDisplaySize.w || 256;
        const canvasH = canvasDisplaySize.h || 256;
        const initialScale = Math.min(canvasW / img.naturalWidth, canvasH / img.naturalHeight);
        const initialX = (canvasW - img.naturalWidth * initialScale) / 2;
        const initialY = (canvasH - img.naturalHeight * initialScale) / 2;
        setRefImage({
          src,
          x: initialX,
          y: initialY,
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

  const handleRefImageRemove = useCallback(() => {
    setRefImage(null);
  }, []);

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

          if (
            displayX < refImage.x || displayX >= refImage.x + imgDisplayW ||
            displayY < refImage.y || displayY >= refImage.y + imgDisplayH
          ) continue;

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
  }, [refImage, drawing, canvasDisplaySize, activeLayerId, handleLayerChange, pushHistory]);

  const colorRef = useRef<HexColor>(color);

  const handleColorChange = useCallback((newColor: HexColor) => {
    setColor(newColor);
    colorRef.current = newColor;
  }, []);

  const handlePanelToggle = useCallback((panel: 'layers' | 'color' | 'ref') => {
    setOpenPanel(prev => {
      if (prev === panel && panel === 'color') {
        const c = colorRef.current;
        setRecentColors(recents => {
          const filtered = recents.filter(r => r !== c);
          return [c, ...filtered].slice(0, 12);
        });
      }
      return prev === panel ? null : panel;
    });
  }, []);

  const drawingColors = useMemo((): HexColor[] => {
    if (!drawing) return [];
    const set = new Set<HexColor>();
    for (const layer of drawing.data.layers) {
      for (const c of Object.values(layer.pixels)) {
        set.add(c);
      }
    }
    return Array.from(set);
  }, [drawing]);

  if (status === 'loading') {
    return (
      <section className={styles.editor}>
        <div className={styles.centered}>
          <span className={styles.muted}>Chargement…</span>
        </div>
      </section>
    );
  }

  if (status === 'error' || !drawing) {
    return (
      <section className={styles.editor}>
        <div className={styles.centered}>
          <span className={styles.danger}>Impossible de charger le dessin.</span>
          <button className={styles.linkBtn} onClick={() => navigate('/gallery')}>
            ← Retour à la galerie
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className={styles.editor}>
      <Topbar
        title={drawing.title}
        tool={tool}
        onToolChange={setTool}
        activeLayerId={activeLayerId}
        layers={drawing.data.layers}
        color={color}
        openPanel={openPanel}
        onPanelToggle={handlePanelToggle}
        onPanelClose={() => setOpenPanel(null)}
        onLayerAdd={handleLayerAdd}
        onLayerSelect={setActiveLayerId}
        onLayerVisibilityToggle={handleLayerVisibilityToggle}
        onLayerDuplicate={handleLayerDuplicate}
        onLayerDelete={handleLayerDelete}
        onColorChange={handleColorChange}
        onColorHover={setHoveredColor}
        recentColors={recentColors}
        drawingColors={drawingColors}
        onBack={() => navigate('/gallery')}
        refImage={refImage ? { x: refImage.x, y: refImage.y, scale: refImage.scale, opacity: refImage.opacity, naturalWidth: refImage.naturalWidth, naturalHeight: refImage.naturalHeight } : null}
        onRefImageImport={handleRefImageImport}
        onRefImageRemove={handleRefImageRemove}
        onRefImageTransform={handleRefImageTransform}
        onRefImageCapture={handleCapturePixels}
        canvasDisplaySize={canvasDisplaySize}
      />
      <div ref={canvasAreaRef} className={styles.canvasArea}>
        <Canvas
          data={drawing.data}
          activeLayerId={activeLayerId}
          tool={tool}
          color={color}
          mirrorH={mirrorH}
          mirrorV={mirrorV}
          onLayerChange={handleLayerChange}
          onInvisibleLayerAttempt={() => setShowInvisibleModal(true)}
          onDrawStart={handleDrawStart}
          onDrawEnd={handleDrawEnd}
          hoveredColor={hoveredColor}
          refImage={refImage}
          onDisplaySizeChange={setCanvasDisplaySize}
        />
        <div className={styles.sideToolbar}>
          <div className={styles.sideGroup}>
            <Button
              variant={mirrorH ? 'selected' : 'selectable'}
              size="md"
              iconOnly
              iconLeft="mirror"
              title="Miroir horizontal"
              aria-label="Miroir horizontal"
              aria-pressed={mirrorH}
              onClick={() => setMirrorH(v => !v)}
            />
            <Button
              variant={mirrorV ? 'selected' : 'selectable'}
              size="md"
              iconOnly
              iconLeft="mirror-v"
              title="Miroir vertical"
              aria-label="Miroir vertical"
              aria-pressed={mirrorV}
              onClick={() => setMirrorV(v => !v)}
            />
          </div>
          <div className={styles.sideGroup}>
            <Button
              variant="ghost"
              size="md"
              iconOnly
              iconLeft="undo"
              title="Annuler (Ctrl+Z)"
              aria-label="Annuler"
              disabled={!canUndo}
              onClick={handleUndo}
            />
            <Button
              variant="ghost"
              size="md"
              iconOnly
              iconLeft="redo"
              title="Rétablir (Ctrl+Y)"
              aria-label="Rétablir"
              disabled={!canRedo}
              onClick={handleRedo}
            />
          </div>
        </div>
      </div>
      {status === 'saving' && (
        <div className={styles.savingBadge}>Enregistrement…</div>
      )}
      {showInvisibleModal && (
        <div className={styles.modalOverlay} onClick={() => setShowInvisibleModal(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <p className={styles.modalText}>
              Ce calque est masqué. Voulez-vous l'afficher pour pouvoir dessiner dessus ?
            </p>
            <div className={styles.modalActions}>
              <button
                className={styles.modalBtnSecondary}
                onClick={() => setShowInvisibleModal(false)}
              >
                Annuler
              </button>
              <button
                className={styles.modalBtnPrimary}
                onClick={() => {
                  handleLayerVisibilityToggle(activeLayerId);
                  setShowInvisibleModal(false);
                }}
              >
                Afficher le calque
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
