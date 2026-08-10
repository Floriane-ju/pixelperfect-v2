import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, Dispatch, SetStateAction } from 'react';
import { useNavigate } from 'react-router';
import type { DrawingRow, HexColor } from '@/types';
import { ColorSwatch } from '@/components/ColorSwatch';
import { ColorWheelIcon } from '@/components/ColorWheelIcon';
import { BrushSizeSlider } from '@/components/BrushSizeSlider';
import { Button } from '@/components/Button';
import { EditorModals } from './EditorModals';
import { ColorPicker } from './ColorPicker/ColorPicker';
import { ColorPanel } from './ColorPanel';
import { SettingsPanel } from './SettingsPanel';
import { MirrorPanel } from './MirrorPanel';
import type { SymmetryConfig } from './shapePixels';
import { Canvas } from './Canvas/Canvas';
import type { Tool } from './Canvas/Canvas';
import { buildLayersSvg } from './exportSvg';
import { copyLayersPng } from './exportPng';
import { Topbar } from './Topbar/Topbar';
import { useSave } from './hooks/useSave';
import { useUndoRedo } from './hooks/useUndoRedo';
import { useLayers } from './hooks/useLayers';
import { useReferenceImage } from './hooks/useReferenceImage';
import { useColorPalette } from './hooks/useColorPalette';
import { useEditorShortcuts } from './hooks/useEditorShortcuts';
import { useDisplayPanels } from './hooks/useDisplayPanels';
import { useClipboardColor } from './hooks/useClipboardColor';
import { useOutsideDismiss } from '@/hooks/useOutsideDismiss';
import { useSelection } from './hooks/useSelection';
import { EditorContext } from './EditorContext';
import type { EditorContextValue } from './EditorContext';
import { LOCAL_OWNER } from '@/lib/localLibrary';
import styles from './Editor.module.scss';

export interface EditorReadyProps {
  /** Garanti non nul : `Editor` a déjà passé ses retours anticipés. */
  drawing: DrawingRow;
  setDrawing: Dispatch<SetStateAction<DrawingRow | null>>;
  id: string | undefined;
}

export function EditorReady({ drawing, setDrawing, id }: EditorReadyProps) {
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'ready' | 'error' | 'saving'>('ready');
  const [tool, setTool] = useState<Tool>('pencil');
  const [brushSize, setBrushSize] = useState<number>(1);
  const [activeLayerId, setActiveLayerId] = useState<string>('');
  const [showInvisibleModal, setShowInvisibleModal] = useState(false);
  const [showCaptureModal, setShowCaptureModal] = useState(false);
  const [canvasDisplaySize, setCanvasDisplaySize] = useState({ w: 256, h: 256 });
  const {
    showMirror, showGrid, showSettings, mirrorAxis, mirrorRotation, radialSegments, gridOpacity, bgColor,
    handleShowGridToggle, handleSettingsToggle, handleSettingsClose, handleMirrorToggle, handleMirrorClose,
    handleMirrorRotationToggle, setMirrorAxis, setRadialSegments, setGridOpacity, setBgColor,
  } = useDisplayPanels();
  const canvasAreaRef = useRef<HTMLDivElement>(null);
  const leftSidebarRef = useRef<HTMLElement>(null);
  const mirrorContainerRef = useRef<HTMLDivElement>(null);
  const settingsContainerRef = useRef<HTMLDivElement>(null);
  const rightSidebarRef = useRef<HTMLElement>(null);

  // Initialiser activeLayerId au rendu
  useEffect(() => {
    const visibleLayers = drawing.data.layers.filter(l => l.visible);
    const topmost = visibleLayers[visibleLayers.length - 1] ?? drawing.data.layers[drawing.data.layers.length - 1];
    setActiveLayerId(topmost?.id ?? '');
  }, [drawing.data.layers]);

  const { scheduleSave, latestDataRef } = useSave({
    id,
    drawing,
    authed: drawing.owner_id !== LOCAL_OWNER,
    setStatus,
  });
  const { canUndo, canRedo, pushHistory, handleDrawStart, handleDrawEnd, handleUndo, handleRedo } = useUndoRedo({ latestDataRef, setDrawing, scheduleSave });
  const { handleLayerChange, handleLayerVisibilityToggle, handleLayerDuplicate, handleLayerAdd, handleLayerDelete, handleLayerReorder } = useLayers({ drawing, setDrawing, activeLayerId, setActiveLayerId, scheduleSave, pushHistory, latestDataRef });
  const { refImage, refImageError, clearRefImageError, handleRefImageImport, handleRefImageRemove, handleRefImageTransform, handleCapturePixels } = useReferenceImage({ canvasDisplaySize, activeLayerId, drawing, handleLayerChange, pushHistory, latestDataRef });
  const {
    color, drawingColors, openPanel, setOpenPanel, hoveredColor, setHoveredColor,
    editColorMode, editColorPanelRef,
    isNormalPick, displayedRecentColors,
    handleColorChange, commitRecentColor, handlePanelToggle, handleEditDrawingColor,
  } = useColorPalette({ drawing, setDrawing, scheduleSave, pushHistory, latestDataRef, rightSidebarRef });

  const selection = useSelection({
    data: drawing.data,
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

  useClipboardColor({ onColorChange: handleColorChange, commitRecentColor });

  const handleHoverLeave = useCallback(() => setHoveredColor(null), [setHoveredColor]);

  const handleCopySvg = useCallback(() => {
    const { layers, width, height } = drawing.data;
    navigator.clipboard.writeText(buildLayersSvg(layers, width, height)).catch(() => undefined);
  }, [drawing.data]);

  const handleCopyPng = useCallback(() => {
    const { layers, width, height } = drawing.data;
    copyLayersPng(layers, width, height).catch(() => undefined);
  }, [drawing.data]);

  const handleBack = useCallback(() => navigate('/'), [navigate]);
  const handlePanelClose = useCallback(() => setOpenPanel(null), [setOpenPanel]);

  const handleCaptureRequest = useCallback(() => {
    const activeLayer = drawing.data.layers.find(l => l.id === activeLayerId);
    if (activeLayer && Object.keys(activeLayer.pixels).length > 0) {
      setShowCaptureModal(true);
      return;
    }
    handleCapturePixels();
  }, [drawing.data.layers, activeLayerId, handleCapturePixels]);

  // Mémoïser le contexte pour éviter les re-rendus inutiles des consommateurs
  const editorCtx = useMemo<EditorContextValue>(() => ({
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
    onCopyPng: handleCopyPng,
  }), [
    drawing.title,
    drawing.data.layers,
    drawing.data.width,
    drawing.data.height,
    tool,
    canUndo,
    canRedo,
    handleUndo,
    handleRedo,
    activeLayerId,
    openPanel,
    handlePanelToggle,
    handlePanelClose,
    handleLayerAdd,
    handleLayerVisibilityToggle,
    handleLayerDuplicate,
    handleLayerDelete,
    handleLayerReorder,
    handleBack,
    topbarRefImage,
    refImageError,
    handleRefImageImport,
    clearRefImageError,
    handleRefImageRemove,
    handleRefImageTransform,
    handleCaptureRequest,
    canvasDisplaySize,
    handleCopySvg,
    handleCopyPng,
  ]);

  return (
    <EditorContext.Provider value={editorCtx}>
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
                    onEdit={handleEditDrawingColor}
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

        <EditorModals
          showInvisibleLayer={showInvisibleModal}
          onInvisibleLayerCancel={() => setShowInvisibleModal(false)}
          onInvisibleLayerConfirm={() => {
            handleLayerVisibilityToggle(activeLayerId);
            setShowInvisibleModal(false);
          }}
          showCapture={showCaptureModal}
          onCaptureCancel={() => setShowCaptureModal(false)}
          onCaptureConfirm={() => {
            setShowCaptureModal(false);
            handleCapturePixels();
          }}
        />
      </main>
    </EditorContext.Provider>
  );
}
