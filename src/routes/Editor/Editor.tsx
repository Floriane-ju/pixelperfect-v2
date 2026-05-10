import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { fetchDrawing } from '@/lib/drawings';
import type { DrawingRow, HexColor } from '@/types';
import { ColorSwatch } from '@/components/ColorSwatch';
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
import { EditorContext } from './EditorContext';
import type { EditorContextValue } from './EditorContext';
import styles from './Editor.module.scss';

type Status = 'loading' | 'ready' | 'error' | 'saving';

export function Editor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [drawing, setDrawing] = useState<DrawingRow | null>(null);
  const [status, setStatus] = useState<Status>('loading');
  const [tool, setTool] = useState<Tool>('pencil');
  const [activeLayerId, setActiveLayerId] = useState<string>('');
  const [showInvisibleModal, setShowInvisibleModal] = useState(false);
  const [mirrorH, setMirrorH] = useState(false);
  const [mirrorV, setMirrorV] = useState(false);
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
  const { handleLayerChange, handleLayerVisibilityToggle, handleLayerDuplicate, handleLayerAdd, handleLayerDelete } = useLayers({ drawing, setDrawing, activeLayerId, setActiveLayerId, scheduleSave, pushHistory, latestDataRef });
  const { refImage, handleRefImageImport, handleRefImageRemove, handleRefImageTransform, handleCapturePixels } = useReferenceImage({ canvasDisplaySize, activeLayerId, drawing, handleLayerChange, pushHistory, latestDataRef });
  const {
    color, drawingColors, openPanel, setOpenPanel, hoveredColor, setHoveredColor,
    contextMenu, setContextMenu, editColorMode, editColorPanelRef,
    isNormalPick, displayedRecentColors,
    handleColorChange, handlePanelToggle, handleEditDrawingColor,
  } = useColorPalette({ drawing, setDrawing, scheduleSave, pushHistory, latestDataRef, rightSidebarRef });

  useEditorShortcuts({ handleUndo, handleRedo });

  const topbarRefImage = useMemo(() =>
    refImage ? { x: refImage.x, y: refImage.y, scale: refImage.scale, opacity: refImage.opacity, naturalWidth: refImage.naturalWidth, naturalHeight: refImage.naturalHeight } : null,
    [refImage]
  );

  const handleSwatchColorChange = useCallback((c: string) => handleColorChange(c as HexColor), [handleColorChange]);

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

  if (status === 'loading') {
    return (
      <main className={styles.editor}>
        <div className={styles.centered}>
          <span className={styles.muted}>Chargement…</span>
        </div>
      </main>
    );
  }

  if (status === 'error' || !drawing) {
    return (
      <main className={styles.editor}>
        <div className={styles.centered}>
          <span className={styles.danger}>Impossible de charger le dessin.</span>
          <button className={styles.linkBtn} onClick={() => navigate('/')}>
            ← Retour à la galerie
          </button>
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
    mirrorH,
    mirrorV,
    onMirrorHChange: setMirrorH,
    onMirrorVChange: setMirrorV,
    activeLayerId,
    layers: drawing.data.layers,
    openPanel,
    onPanelToggle: handlePanelToggle,
    onPanelClose: handlePanelClose,
    onLayerAdd: handleLayerAdd,
    onLayerSelect: setActiveLayerId,
    onLayerVisibilityToggle: handleLayerVisibilityToggle,
    onLayerDuplicate: handleLayerDuplicate,
    onLayerDelete: handleLayerDelete,
    onBack: handleBack,
    refImage: topbarRefImage,
    onRefImageImport: handleRefImageImport,
    onRefImageRemove: handleRefImageRemove,
    onRefImageTransform: handleRefImageTransform,
    onRefImageCapture: handleCapturePixels,
    canvasDisplaySize,
    onCopySvg: handleCopySvg,
  };

  return (
    <EditorContext.Provider value={editorCtx}>
      <main className={`${styles.editor}`}>
        <a className="skip-link" href="#canvas">Aller au canvas</a>
        <Topbar />

        <div className={styles.body}>
          <div ref={canvasAreaRef} id="canvas" className={styles.canvasArea}>
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
          </div>

          <aside ref={rightSidebarRef} className={styles.rightSidebar}>
            <div className={styles.colorWheelContainer}>
              <button
                className={styles.colorWheelBtn}
                title="Choisir une couleur"
                aria-label="Choisir une couleur"
                aria-expanded={openPanel === 'color' && !editColorMode}
                onClick={() => handlePanelToggle('color')}
              />
              {openPanel === 'color' && !editColorMode && (
                <div className={styles.colorPanel}>
                  <ColorPicker value={color} onChange={handleColorChange} onColorHover={setHoveredColor} recentColors={displayedRecentColors} drawingColors={drawingColors} />
                </div>
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
          <div
            ref={editColorPanelRef}
            className={styles.editColorPanel}
            style={{ top: editColorMode.pickerY }}
          >
            <ColorPicker value={color} onChange={handleColorChange} onColorHover={setHoveredColor} recentColors={displayedRecentColors} drawingColors={drawingColors} />
          </div>
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
          <div className={styles.modalOverlay} onClick={() => setShowInvisibleModal(false)}>
            <div className={styles.modal} onClick={e => e.stopPropagation()}>
              <p className={styles.modalText}>
                Ce calque est masqué. Voulez-vous l'afficher pour pouvoir dessiner dessus ?
              </p>
              <div className={styles.modalActions}>
                <button className={styles.modalBtnSecondary} onClick={() => setShowInvisibleModal(false)}>
                  Annuler
                </button>
                <button
                  className={styles.modalBtnPrimary}
                  onClick={() => { handleLayerVisibilityToggle(activeLayerId); setShowInvisibleModal(false); }}
                >
                  Afficher le calque
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </EditorContext.Provider>
  );
}
