import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { useNavigate, useParams } from 'react-router';
import { LOCAL_OWNER } from '@/lib/localLibrary';
import type { DrawingData, HexColor } from '@/types';
import { ColorSwatch } from '@/components/ColorSwatch';
import { ColorWheelIcon } from '@/components/ColorWheelIcon';
import { BrushSizeSlider } from '@/components/BrushSizeSlider';
import { Button } from '@/components/Button';
import { ConfirmModal } from '@/components/ConfirmModal';
import { ColorPicker } from './ColorPicker/ColorPicker';
import { ColorPanel } from './ColorPanel';
import { EditorLoading, EditorError } from './EditorStates';
import { SettingsPanel } from './SettingsPanel';
import type { EditorBgColor } from './SettingsPanel';
import { MirrorPanel } from './MirrorPanel';
import type { RadialSegments } from './MirrorPanel';
import type { MirrorAxis, SymmetryConfig } from './shapePixels';
import { Canvas } from './Canvas/Canvas';
import type { Tool } from './Canvas/Canvas';
import { Topbar } from './Topbar/Topbar';
import { useSave } from './hooks/useSave';
import { useEditorDrawing } from './hooks/useEditorDrawing';
import { useHexPaste } from './hooks/useHexPaste';
import { useUndoRedo } from './hooks/useUndoRedo';
import { useLayers } from './hooks/useLayers';
import { useReferenceImage } from './hooks/useReferenceImage';
import { useColorPalette } from './hooks/useColorPalette';
import { useEditorShortcuts } from './hooks/useEditorShortcuts';
import { useOutsideDismiss } from '@/hooks/useOutsideDismiss';
import { useSelection } from './hooks/useSelection';
import { EditorContext } from './EditorContext';
import type { EditorContextValue } from './EditorContext';
import styles from './Editor.module.scss';

const FALLBACK_DATA: DrawingData = { width: 1, height: 1, layers: [] };

export function Editor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { drawing, setDrawing, status, setStatus, activeLayerId, setActiveLayerId } = useEditorDrawing(id);
  const [tool, setTool] = useState<Tool>('pencil');
  const [brushSize, setBrushSize] = useState<number>(1);
  const [showInvisibleModal, setShowInvisibleModal] = useState(false);
  const [showCaptureModal, setShowCaptureModal] = useState(false);
  const [mirrorAxis, setMirrorAxis] = useState<MirrorAxis>('none');
  const [mirrorRotation, setMirrorRotation] = useState(false);
  const [radialSegments, setRadialSegments] = useState<RadialSegments>(4);
  const [showMirror, setShowMirror] = useState(false);
  const [showGrid, setShowGrid] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [gridOpacity, setGridOpacity] = useState(0.4);
  const [bgColor, setBgColor] = useState<EditorBgColor>('white');
  const [canvasDisplaySize, setCanvasDisplaySize] = useState({ w: 256, h: 256 });
  const canvasAreaRef = useRef<HTMLDivElement>(null);
  const leftSidebarRef = useRef<HTMLElement>(null);
  const mirrorContainerRef = useRef<HTMLDivElement>(null);
  const settingsContainerRef = useRef<HTMLDivElement>(null);
  const rightSidebarRef = useRef<HTMLElement>(null);

  // Le backend est lié au dessin chargé (immuable), pas à la session vivante : un changement
  // d'auth en cours d'édition ne doit pas réorienter les sauvegardes vers le mauvais backend.
  const { scheduleSave, latestDataRef } = useSave({
    id,
    drawing,
    authed: drawing !== null && drawing.owner_id !== LOCAL_OWNER,
    setStatus,
  });
  const { canUndo, canRedo, pushHistory, handleDrawStart, handleDrawEnd, handleUndo, handleRedo } = useUndoRedo({ latestDataRef, setDrawing, scheduleSave });
  const { handleLayerChange, handleLayerVisibilityToggle, handleLayerDuplicate, handleLayerAdd, handleLayerDelete, handleLayerReorder } = useLayers({ setDrawing, setActiveLayerId, scheduleSave, pushHistory, latestDataRef });
  const { refImage, refImageError, clearRefImageError, handleRefImageImport, handleRefImageRemove, handleRefImageTransform, handleCapturePixels } = useReferenceImage({ canvasDisplaySize, activeLayerId, drawing, handleLayerChange, pushHistory, latestDataRef });
  const {
    color, drawingColors, openPanel, setOpenPanel, hoveredColor, setHoveredColor,
    editColorMode, editColorPanelRef,
    isNormalPick, displayedRecentColors,
    handleColorChange, commitRecentColor, handlePanelToggle, handleEditDrawingColor,
  } = useColorPalette({ drawing, setDrawing, scheduleSave, pushHistory, latestDataRef, rightSidebarRef });

  const selection = useSelection({
    data: drawing?.data ?? FALLBACK_DATA,
    activeLayerId,
    onLayerChange: handleLayerChange,
    pushHistory,
    latestDataRef,
  });
  const selectionRef = useRef(selection);
  // Lu par les gestionnaires d'événements et les effets : synchronisé avant eux, pas pendant le rendu.
  useLayoutEffect(() => { selectionRef.current = selection; });

  useEffect(() => {
    if (tool !== 'select' && selectionRef.current.hasFloating) {
      selectionRef.current.commit();
    }
  }, [tool]);

  useEffect(() => {
    if (selectionRef.current.hasFloating) selectionRef.current.commit();
  }, [activeLayerId]);

  // Sélection flottante : son commit repartirait de l'instantané pris à la levée et annulerait
  // l'undo/redo. Undo = abandon de la sélection ; redo attend qu'elle soit posée.
  const undo = useCallback(() => {
    if (selectionRef.current.hasFloating) selectionRef.current.cancel();
    else handleUndo();
  }, [handleUndo]);
  const redo = useCallback(() => {
    if (!selectionRef.current.hasFloating) handleRedo();
  }, [handleRedo]);

  useEditorShortcuts({ handleUndo: undo, handleRedo: redo, setTool, selectionRef });

  // Opération structurelle sur les calques : la sélection flottante est posée d'abord, sinon
  // l'historique capturerait l'état « pixels levés » et l'undo ferait disparaître la sélection.
  const afterCommit = <A extends unknown[]>(fn: (...args: A) => void) => (...args: A) => {
    selectionRef.current.commit();
    fn(...args);
  };

  const handleShowGridToggle = useCallback(() => setShowGrid(v => !v), []);
  const handleSettingsToggle = useCallback(() => setShowSettings(v => !v), []);
  const handleSettingsClose = useCallback(() => setShowSettings(false), []);
  const handleMirrorToggle = useCallback(() => setShowMirror(v => !v), []);
  const handleMirrorClose = useCallback(() => setShowMirror(false), []);
  const handleMirrorRotationToggle = useCallback(() => setMirrorRotation(v => !v), []);

  const symmetry = useMemo<SymmetryConfig>(() => ({
    axis: mirrorAxis,
    rotation: mirrorRotation,
    radialSegments,
  }), [mirrorAxis, mirrorRotation, radialSegments]);

  useOutsideDismiss({
    active: showSettings,
    refs: [settingsContainerRef],
    onDismiss: handleSettingsClose,
  });

  useOutsideDismiss({
    active: showMirror,
    refs: [mirrorContainerRef],
    onDismiss: handleMirrorClose,
  });

  const topbarRefImage = useMemo(() =>
    refImage ? { x: refImage.x, y: refImage.y, scale: refImage.scale, opacity: refImage.opacity, naturalWidth: refImage.naturalWidth, naturalHeight: refImage.naturalHeight } : null,
    [refImage]
  );

  const handlePickColor = useCallback((c: HexColor) => {
    handleColorChange(c);
    commitRecentColor(c);
    setTool('pencil');
  }, [handleColorChange, commitRecentColor]);

  const handlePastedColor = useCallback((hex: HexColor) => {
    handleColorChange(hex);
    commitRecentColor(hex);
  }, [handleColorChange, commitRecentColor]);
  useHexPaste(handlePastedColor);

  const handleHoverLeave = useCallback(() => setHoveredColor(null), [setHoveredColor]);

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

  if (status === 'loading') return <EditorLoading />;
  // 'error' une fois le dessin chargé = échec de sauvegarde : badge, pas d'écran d'erreur.
  if (!drawing) return <EditorError />;

  const editorCtx: EditorContextValue = {
    title: drawing.title,
    tool,
    onToolChange: setTool,
    canUndo,
    canRedo,
    onUndo: undo,
    onRedo: redo,
    activeLayerId,
    layers: drawing.data.layers,
    canvasWidth: drawing.data.width,
    canvasHeight: drawing.data.height,
    openPanel,
    onPanelToggle: handlePanelToggle,
    onPanelClose: handlePanelClose,
    onLayerAdd: afterCommit(handleLayerAdd),
    onLayerSelect: setActiveLayerId,
    onLayerVisibilityToggle: afterCommit(handleLayerVisibilityToggle),
    onLayerDuplicate: afterCommit(handleLayerDuplicate),
    onLayerDelete: afterCommit(handleLayerDelete),
    onLayerReorder: afterCommit(handleLayerReorder),
    onBack: handleBack,
    refImage: topbarRefImage,
    refImageError,
    onRefImageImport: handleRefImageImport,
    onRefImageErrorClear: clearRefImageError,
    onRefImageRemove: handleRefImageRemove,
    onRefImageTransform: handleRefImageTransform,
    onRefImageCapture: afterCommit(handleCaptureRequest),
    getCommittedLayers: () => {
      selectionRef.current.commit();
      return latestDataRef.current?.layers ?? drawing.data.layers;
    },
    canvasDisplaySize,
  };

  return (
    <EditorContext value={editorCtx}>
      <main className={styles.editor}>
        <a className="skip-link" href="#canvas">Aller au canvas</a>
        <Topbar />

        <div className={styles.body}>
          <div
            ref={canvasAreaRef}
            className={styles.canvasArea}
            data-bg={bgColor}
            style={{ ['--checker-opacity' as string]: String(gridOpacity) } as CSSProperties}
          >
            <aside ref={leftSidebarRef} className={styles.leftSidebar} aria-label="Outils d'affichage">
              <BrushSizeSlider value={brushSize} onChange={setBrushSize} min={1} max={16} />
              <div className={styles.leftSidebarTools}>
                <div ref={mirrorContainerRef} className={styles.settingsContainer}>
                  <Button
                    variant={mirrorAxis !== 'none' ? 'selected' : 'selectable'}
                    size="md"
                    iconOnly
                    iconLeft={mirrorAxis === 'vertical' ? 'mirror-v' : mirrorAxis === 'radial' ? 'radial' : 'mirror'}
                    title="Symétrie"
                    aria-label="Symétrie"
                    aria-pressed={mirrorAxis !== 'none'}
                    aria-expanded={showMirror}
                    onClick={handleMirrorToggle}
                  />
                  {showMirror && (
                    <div className={styles.settingsPanelAnchor}>
                      <MirrorPanel
                        axis={mirrorAxis}
                        rotation={mirrorRotation}
                        radialSegments={radialSegments}
                        onAxisChange={setMirrorAxis}
                        onRotationToggle={handleMirrorRotationToggle}
                        onRadialSegmentsChange={setRadialSegments}
                        onClose={handleMirrorClose}
                      />
                    </div>
                  )}
                </div>
                <div ref={settingsContainerRef} className={styles.settingsContainer}>
                  <Button
                    variant={showSettings ? 'selected' : 'selectable'}
                    size="md"
                    iconOnly
                    iconLeft="settings"
                    title="Paramètres"
                    aria-label="Paramètres"
                    aria-expanded={showSettings}
                    onClick={handleSettingsToggle}
                  />
                  {showSettings && (
                    <div className={styles.settingsPanelAnchor}>
                      <SettingsPanel
                        showGrid={showGrid}
                        gridOpacity={gridOpacity}
                        bgColor={bgColor}
                        onShowGridToggle={handleShowGridToggle}
                        onGridOpacityChange={setGridOpacity}
                        onBgColorChange={setBgColor}
                        onClose={handleSettingsClose}
                      />
                    </div>
                  )}
                </div>
              </div>
            </aside>

            <Canvas
              data={drawing.data}
              activeLayerId={activeLayerId}
              tool={tool}
              color={color}
              brushSize={brushSize}
              symmetry={symmetry}
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
              title={drawing.title}
            />

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
                        onColorChange={handleColorChange}
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
                    onColorChange={handleColorChange}
                    onEdit={afterCommit(handleEditDrawingColor)}
                    onHoverEnter={setHoveredColor}
                    onHoverLeave={handleHoverLeave}
                  />
                ))}
              </div>
            </aside>
          </div>
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

        {status === 'saving' && <div className={styles.savingBadge} aria-live="polite">Enregistrement…</div>}
        {status === 'error' && <div className={styles.savingBadge} role="status">Non enregistré</div>}

        {showInvisibleModal && (
          <ConfirmModal
            message="Ce calque est masqué. Voulez-vous l'afficher pour pouvoir dessiner dessus ?"
            confirmLabel="Afficher le calque"
            onCancel={() => setShowInvisibleModal(false)}
            onConfirm={() => { handleLayerVisibilityToggle(activeLayerId); setShowInvisibleModal(false); }}
          />
        )}

        {showCaptureModal && (
          <ConfirmModal
            message="Cette action remplit le calque actif avec les couleurs de la référence et écrase les pixels existants. Continuer ?"
            confirmLabel="Capturer"
            onCancel={() => setShowCaptureModal(false)}
            onConfirm={() => { setShowCaptureModal(false); handleCapturePixels(); }}
          />
        )}
      </main>
    </EditorContext>
  );
}
