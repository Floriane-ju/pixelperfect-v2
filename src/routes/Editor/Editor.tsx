import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, ReactNode, RefObject } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { fetchDrawing } from '@/lib/drawings';
import type { DrawingRow, HexColor } from '@/types';
import { ColorSwatch } from '@/components/ColorSwatch';
import { ColorWheelIcon } from '@/components/ColorWheelIcon';
import { BrushSizeSlider } from '@/components/BrushSizeSlider';
import { Button } from '@/components/Button';
import { ColorPicker } from './ColorPicker/ColorPicker';
import { ContextMenu } from './ContextMenu/ContextMenu';
import { Canvas } from './Canvas/Canvas';
import type { Tool } from './Canvas/Canvas';
import { buildLayersSvg } from './exportSvg';
import { Topbar } from './Topbar/Topbar';
import { useSave } from './hooks/useSave';
import { useUndoRedo } from './hooks/useUndoRedo';
import { useLayers } from './hooks/useLayers';
import { useReferenceImage } from './hooks/useReferenceImage';
import { useColorPalette } from './hooks/useColorPalette';
import { useEditorShortcuts } from './hooks/useEditorShortcuts';
import { useSelection } from './hooks/useSelection';
import { useModalA11y } from '@/hooks/useModalA11y';
import { EditorContext } from './EditorContext';
import type { EditorContextValue } from './EditorContext';
import styles from './Editor.module.scss';

interface InvisibleLayerModalProps {
  onCancel: () => void;
  onConfirm: () => void;
}

function InvisibleLayerModal({ onCancel, onConfirm }: InvisibleLayerModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  useModalA11y({ modalRef, onClose: onCancel });
  return (
    <div className={styles.modalOverlay} onClick={onCancel}>
      <div
        ref={modalRef}
        className={styles.modal}
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="invisible-layer-text"
      >
        <p id="invisible-layer-text" className={styles.modalText}>
          Ce calque est masqué. Voulez-vous l'afficher pour pouvoir dessiner dessus ?
        </p>
        <div className={styles.modalActions}>
          <Button variant="secondary" size="sm" onClick={onCancel}>
            Annuler
          </Button>
          <Button variant="primary" size="sm" onClick={onConfirm}>
            Afficher le calque
          </Button>
        </div>
      </div>
    </div>
  );
}

interface ColorPanelProps {
  children: ReactNode;
  onClose: () => void;
  className?: string;
  style?: CSSProperties;
  panelRef?: RefObject<HTMLDivElement>;
}

function ColorPanel({ children, onClose, className, style, panelRef }: ColorPanelProps) {
  const localRef = useRef<HTMLDivElement>(null);
  const ref = panelRef ?? localRef;
  useModalA11y({ modalRef: ref, onClose, closeOnEscape: false });
  return (
    <div ref={ref} className={className} style={style}>
      {children}
    </div>
  );
}

interface CapturePixelsModalProps {
  onCancel: () => void;
  onConfirm: () => void;
}

function CapturePixelsModal({ onCancel, onConfirm }: CapturePixelsModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  useModalA11y({ modalRef, onClose: onCancel });
  return (
    <div className={styles.modalOverlay} onClick={onCancel}>
      <div
        ref={modalRef}
        className={styles.modal}
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="capture-pixels-text"
      >
        <p id="capture-pixels-text" className={styles.modalText}>
          Cette action remplit le calque actif avec les couleurs de la référence et écrase les pixels existants. Continuer ?
        </p>
        <div className={styles.modalActions}>
          <Button variant="secondary" size="sm" onClick={onCancel}>
            Annuler
          </Button>
          <Button variant="primary" size="sm" onClick={onConfirm}>
            Capturer
          </Button>
        </div>
      </div>
    </div>
  );
}

type Status = 'loading' | 'ready' | 'error' | 'saving';

export function Editor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [drawing, setDrawing] = useState<DrawingRow | null>(null);
  const [status, setStatus] = useState<Status>('loading');
  const [tool, setTool] = useState<Tool>('pencil');
  const [brushSize, setBrushSize] = useState<number>(1);
  const [activeLayerId, setActiveLayerId] = useState<string>('');
  const [showInvisibleModal, setShowInvisibleModal] = useState(false);
  const [showCaptureModal, setShowCaptureModal] = useState(false);
  const [mirrorH, setMirrorH] = useState(false);
  const [mirrorV, setMirrorV] = useState(false);
  const [showGrid, setShowGrid] = useState(false);
  const [canvasDisplaySize, setCanvasDisplaySize] = useState({ w: 256, h: 256 });
  const canvasAreaRef = useRef<HTMLDivElement>(null);
  const rightSidebarRef = useRef<HTMLElement>(null);

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

  const { scheduleSave, latestDataRef } = useSave({ id, drawing, setStatus });
  const { canUndo, canRedo, pushHistory, handleDrawStart, handleDrawEnd, handleUndo, handleRedo } = useUndoRedo({ latestDataRef, setDrawing, scheduleSave });
  const { handleLayerChange, handleLayerVisibilityToggle, handleLayerDuplicate, handleLayerAdd, handleLayerDelete, handleLayerReorder } = useLayers({ drawing, setDrawing, activeLayerId, setActiveLayerId, scheduleSave, pushHistory, latestDataRef });
  const { refImage, refImageError, clearRefImageError, handleRefImageImport, handleRefImageRemove, handleRefImageTransform, handleCapturePixels } = useReferenceImage({ canvasDisplaySize, activeLayerId, drawing, handleLayerChange, pushHistory, latestDataRef });
  const {
    color, drawingColors, openPanel, setOpenPanel, hoveredColor, setHoveredColor,
    contextMenu, setContextMenu, editColorMode, editColorPanelRef,
    isNormalPick, displayedRecentColors,
    handleColorChange, commitRecentColor, handlePanelToggle, handleEditDrawingColor,
  } = useColorPalette({ drawing, setDrawing, scheduleSave, pushHistory, latestDataRef, rightSidebarRef });

  const fallbackData = useMemo(() => ({ width: 1, height: 1, layers: [] }), []);
  const selection = useSelection({
    data: drawing?.data ?? fallbackData,
    activeLayerId,
    onLayerChange: handleLayerChange,
    pushHistory,
    latestDataRef,
  });
  const selectionRef = useRef(selection);
  selectionRef.current = selection;

  useEffect(() => {
    if (tool !== 'select' && selectionRef.current.hasFloating) {
      selectionRef.current.commit();
    }
  }, [tool]);

  useEditorShortcuts({ handleUndo, handleRedo, setTool, selectionRef });

  const handleShowGridToggle = useCallback(() => setShowGrid(v => !v), []);

  const topbarRefImage = useMemo(() =>
    refImage ? { x: refImage.x, y: refImage.y, scale: refImage.scale, opacity: refImage.opacity, naturalWidth: refImage.naturalWidth, naturalHeight: refImage.naturalHeight } : null,
    [refImage]
  );

  const handleSwatchColorChange = useCallback((c: string) => handleColorChange(c as HexColor), [handleColorChange]);

  const handlePickColor = useCallback((c: HexColor) => {
    handleColorChange(c);
    commitRecentColor(c);
    setTool('pencil');
  }, [handleColorChange, commitRecentColor]);

  useEffect(() => {
    const handler = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
      const text = e.clipboardData?.getData('text') ?? '';
      const raw = text.trim().replace(/^#/, '');
      if (!/^([0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(raw)) return;
      e.preventDefault();
      const hex = `#${raw.toUpperCase()}` as HexColor;
      handleColorChange(hex);
      commitRecentColor(hex);
    };
    document.addEventListener('paste', handler);
    return () => document.removeEventListener('paste', handler);
  }, [handleColorChange, commitRecentColor]);

  const handleSwatchContextMenu = useCallback((c: string, x: number, y: number) => {
    setContextMenu({ color: c as HexColor, x, y });
  }, [setContextMenu]);

  const handleHoverLeave = useCallback(() => setHoveredColor(null), [setHoveredColor]);
  const handleHoverEnter = useCallback((c: string) => setHoveredColor(c as HexColor), [setHoveredColor]);

  const handleCopySvg = useCallback(() => {
    if (!drawing) return;
    const { layers, width, height } = drawing.data;
    navigator.clipboard.writeText(buildLayersSvg(layers, width, height)).catch(() => undefined);
  }, [drawing]);

  const handleBack = useCallback(() => navigate('/'), [navigate]);
  const handlePanelClose = useCallback(() => setOpenPanel(null), [setOpenPanel]);

  const handleCaptureRequest = useCallback(() => {
    const activeLayer = drawing?.data.layers.find(l => l.id === activeLayerId);
    if (activeLayer && Object.keys(activeLayer.pixels).length > 0) {
      setShowCaptureModal(true);
      return;
    }
    handleCapturePixels();
  }, [drawing, activeLayerId, handleCapturePixels]);

  if (status === 'loading') {
    return (
      <main className={styles.editor}>
        <div className={styles.centered}>
          <span className={styles.muted} role="status" aria-live="polite">Chargement…</span>
        </div>
      </main>
    );
  }

  if (status === 'error' || !drawing) {
    return (
      <main className={styles.editor}>
        <div className={styles.centered}>
          <span className={styles.danger} role="alert">Impossible de charger le dessin.</span>
          <Button variant="ghost" size="sm" iconLeft="back" onClick={() => navigate('/')}>
            Retour à la galerie
          </Button>
        </div>
      </main>
    );
  }

  const editorCtx: EditorContextValue = {
    title: drawing.title,
    tool,
    onToolChange: setTool,
    canUndo,
    canRedo,
    onUndo: handleUndo,
    onRedo: handleRedo,
    activeLayerId,
    layers: drawing.data.layers,
    canvasWidth: drawing.data.width,
    canvasHeight: drawing.data.height,
    openPanel,
    onPanelToggle: handlePanelToggle,
    onPanelClose: handlePanelClose,
    onLayerAdd: handleLayerAdd,
    onLayerSelect: setActiveLayerId,
    onLayerVisibilityToggle: handleLayerVisibilityToggle,
    onLayerDuplicate: handleLayerDuplicate,
    onLayerDelete: handleLayerDelete,
    onLayerReorder: handleLayerReorder,
    onBack: handleBack,
    refImage: topbarRefImage,
    refImageError,
    onRefImageImport: handleRefImageImport,
    onRefImageErrorClear: clearRefImageError,
    onRefImageRemove: handleRefImageRemove,
    onRefImageTransform: handleRefImageTransform,
    onRefImageCapture: handleCaptureRequest,
    canvasDisplaySize,
    onCopySvg: handleCopySvg,
  };

  return (
    <EditorContext.Provider value={editorCtx}>
      <main className={`${styles.editor}`}>
        <a className="skip-link" href="#canvas">Aller au canvas</a>
        <Topbar />

        <div className={styles.body}>
          <aside className={styles.leftSidebar} aria-label="Outils d'affichage">
            <BrushSizeSlider value={brushSize} onChange={setBrushSize} min={1} max={16} />
            <div className={styles.leftSidebarTools}>
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
              <Button
                variant={showGrid ? 'selected' : 'selectable'}
                size="md"
                iconOnly
                iconLeft="grid"
                title="Afficher la grille"
                aria-label="Afficher la grille"
                aria-pressed={showGrid}
                onClick={handleShowGridToggle}
              />
            </div>
          </aside>
          <div
            ref={canvasAreaRef}
            id="canvas"
            className={styles.canvasArea}
            role="img"
            aria-label={`Dessin « ${drawing.title} » : ${drawing.data.width}×${drawing.data.height} pixels, ${drawing.data.layers.length} calque${drawing.data.layers.length > 1 ? 's' : ''}`}
          >
            <Canvas
              data={drawing.data}
              activeLayerId={activeLayerId}
              tool={tool}
              color={color}
              brushSize={brushSize}
              mirrorH={mirrorH}
              mirrorV={mirrorV}
              onLayerChange={handleLayerChange}
              onInvisibleLayerAttempt={() => setShowInvisibleModal(true)}
              onDrawStart={handleDrawStart}
              onDrawEnd={handleDrawEnd}
              onPickColor={handlePickColor}
              hoveredColor={hoveredColor}
              refImage={refImage}
              onDisplaySizeChange={setCanvasDisplaySize}
              showGrid={showGrid}
              selection={selection}
            />
          </div>

          <aside ref={rightSidebarRef} className={styles.rightSidebar}>
            <div className={styles.colorWheelContainer}>
              <Button
                variant="ghost"
                size="md"
                iconOnly
                title="Choisir une couleur"
                aria-label="Choisir une couleur"
                aria-expanded={openPanel === 'color' && !editColorMode}
                onClick={() => handlePanelToggle('color')}
              >
                <ColorWheelIcon size={32} />
              </Button>
              {openPanel === 'color' && !editColorMode && (
                <ColorPanel className={styles.colorPanel} onClose={handlePanelClose}>
                  <ColorPicker value={color} onChange={handleColorChange} onColorHover={setHoveredColor} recentColors={displayedRecentColors} drawingColors={drawingColors} />
                </ColorPanel>
              )}
            </div>
            {displayedRecentColors.length > 0 && (
              <>
                <div className={styles.colorDivider} />
                <div className={styles.recentColors}>
                  {displayedRecentColors.map((c, i) => (
                    <ColorSwatch
                      key={c}
                      color={c}
                      isPreview={isNormalPick && i === 0}
                      onColorChange={handleSwatchColorChange}
                    />
                  ))}
                </div>
              </>
            )}
            {drawingColors.length > 0 && <div className={styles.colorDivider} />}
            <div className={styles.drawingColors}>
              {drawingColors.map(c => (
                <ColorSwatch
                  key={c}
                  color={c}
                  displayColor={editColorMode?.originalColor === c ? color : undefined}
                  onColorChange={handleSwatchColorChange}
                  onContextMenu={handleSwatchContextMenu}
                  onHoverEnter={handleHoverEnter}
                  onHoverLeave={handleHoverLeave}
                />
              ))}
            </div>
          </aside>
        </div>

        {openPanel === 'color' && editColorMode && (
          <ColorPanel
            panelRef={editColorPanelRef}
            className={styles.editColorPanel}
            style={{ top: editColorMode.pickerY }}
            onClose={handlePanelClose}
          >
            <ColorPicker value={color} onChange={handleColorChange} onColorHover={setHoveredColor} recentColors={displayedRecentColors} drawingColors={drawingColors} />
          </ColorPanel>
        )}

        {contextMenu && (
          <div className={styles.contextMenuAnchor} style={{ left: contextMenu.x, top: contextMenu.y }}>
            <ContextMenu
              items={[{ label: 'Modifier la couleur', onClick: () => handleEditDrawingColor(contextMenu.color, contextMenu.y) }]}
              onClose={() => setContextMenu(null)}
            />
          </div>
        )}

        {status === 'saving' && <div className={styles.savingBadge} aria-live="polite">Enregistrement…</div>}

        {showInvisibleModal && (
          <InvisibleLayerModal
            onCancel={() => setShowInvisibleModal(false)}
            onConfirm={() => { handleLayerVisibilityToggle(activeLayerId); setShowInvisibleModal(false); }}
          />
        )}

        {showCaptureModal && (
          <CapturePixelsModal
            onCancel={() => setShowCaptureModal(false)}
            onConfirm={() => { setShowCaptureModal(false); handleCapturePixels(); }}
          />
        )}
      </main>
    </EditorContext.Provider>
  );
}
