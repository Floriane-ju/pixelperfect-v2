import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { fetchDrawing, updateDrawingData } from '@/lib/drawings';
import type { DrawingData, DrawingRow, HexColor, PixelLayer } from '@/types';
import { Canvas } from './Canvas';
import { Topbar } from './Topbar';
import styles from './Editor.module.scss';

type Tool = 'pencil' | 'eraser' | 'fill';
type OpenPanel = 'layers' | 'color' | null;
type Status = 'loading' | 'ready' | 'error' | 'saving';

const SAVE_DELAY = 1500;

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

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestDataRef = useRef<DrawingData | null>(null);

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
  }, [scheduleSave]);

  const handleLayerDuplicate = useCallback((layerId: string) => {
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

  const handleLayerDelete = useCallback((layerId: string) => {
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
  }, [scheduleSave, drawing]);

  const handleColorChange = useCallback((newColor: HexColor) => {
    setColor(newColor);
    setRecentColors(prev => {
      const filtered = prev.filter(c => c !== newColor);
      return [newColor, ...filtered].slice(0, 12);
    });
  }, []);

  const handlePanelToggle = useCallback((panel: 'layers' | 'color') => {
    setOpenPanel(prev => prev === panel ? null : panel);
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
        onLayerSelect={setActiveLayerId}
        onLayerVisibilityToggle={handleLayerVisibilityToggle}
        onLayerDuplicate={handleLayerDuplicate}
        onLayerDelete={handleLayerDelete}
        onColorChange={handleColorChange}
        recentColors={recentColors}
        drawingColors={drawingColors}
        onBack={() => navigate('/gallery')}
      />
      <div className={styles.canvasArea}>
        <Canvas
          data={drawing.data}
          activeLayerId={activeLayerId}
          tool={tool}
          color={color}
          onLayerChange={handleLayerChange}
          onInvisibleLayerAttempt={() => setShowInvisibleModal(true)}
        />
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
