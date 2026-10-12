import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { useNavigate, useParams } from 'react-router';
import { LOCAL_OWNER } from '@/lib/localLibrary';
import { DEFAULT_DRAWING_SETTINGS, MAX_LAYERS } from '@/lib/drawingValidation';
import type { DrawingData, DrawingSettings, HexColor } from '@/types';
import { ConfirmModal } from '@/components/ConfirmModal';
import { useSession } from '@/components/SessionProvider';
import { cx } from '@/lib/cx';
import { ColorPicker } from './ColorPicker/ColorPicker';
import { ColorPanel } from './ColorPanel';
import { EditorLoading, EditorError } from './EditorStates';
import type { EditorBgColor } from './SettingsPanel';
import type { RadialSegments } from './MirrorPanel';
import type { MirrorAxis, SymmetryConfig } from './shapePixels';
import { Canvas } from './Canvas/Canvas';
import type { Tool } from './Canvas/Canvas';
import { Topbar } from './Topbar/Topbar';
import { ToolDock } from './ToolDock/ToolDock';
import { ColorRail } from './ColorRail/ColorRail';
import { StatusBar } from './StatusBar/StatusBar';
import { Timeline } from './Timeline';
import { animationLayers, frameIds, previousFrameId } from './animationFrames';
import { mirrorLabel, toolDef } from './tools';
import { useSave } from './hooks/useSave';
import { useEditorDrawing } from './hooks/useEditorDrawing';
import { useHexPaste } from './hooks/useHexPaste';
import { useUndoRedo } from './hooks/useUndoRedo';
import { useLayers } from './hooks/useLayers';
import { useReferenceImage } from './hooks/useReferenceImage';
import { useColorPalette } from './hooks/useColorPalette';
import { useEditorShortcuts } from './hooks/useEditorShortcuts';
import { useSelection } from './hooks/useSelection';
import { useAnimationPlayback } from './hooks/useAnimationPlayback';
import { EditorContext } from './EditorContext';
import type { EditorContextValue } from './EditorContext';
import styles from './Editor.module.scss';

const FALLBACK_DATA: DrawingData = { width: 1, height: 1, layers: [] };

export function Editor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { session } = useSession();

  const { drawing, setDrawing, status, setStatus, activeLayerId, setActiveLayerId } = useEditorDrawing(id);
  const [tool, setTool] = useState<Tool>('pencil');
  const [brushSize, setBrushSize] = useState<number>(1);
  const [showInvisibleModal, setShowInvisibleModal] = useState(false);
  const [showCaptureModal, setShowCaptureModal] = useState(false);
  const [mirrorAxis, setMirrorAxis] = useState<MirrorAxis>('none');
  const [mirrorRotation, setMirrorRotation] = useState(false);
  const [radialSegments, setRadialSegments] = useState<RadialSegments>(4);
  const [showGrid, setShowGrid] = useState(false);
  const [gridOpacity, setGridOpacity] = useState(0.4);
  const [playing, setPlaying] = useState(false);
  const [onionSkin, setOnionSkin] = useState(true);
  const [canvasDisplaySize, setCanvasDisplaySize] = useState({ w: 256, h: 256 });
  const rightSidebarRef = useRef<HTMLElement>(null);

  // Le backend est lié au dessin chargé (immuable), pas à la session vivante : un changement
  // d'auth en cours d'édition ne doit pas réorienter les sauvegardes vers le mauvais backend.
  const { scheduleSave, latestDataRef } = useSave({
    id,
    drawing,
    authed: drawing !== null && drawing.owner_id !== LOCAL_OWNER,
    setStatus,
  });
  // Réglages enregistrés avec le dessin, hors historique d'undo.
  const { bgColor, animationMode, fps } = { ...DEFAULT_DRAWING_SETTINGS, ...drawing?.data.settings };
  const updateSettings = useCallback((patch: DrawingSettings) => {
    setDrawing(prev => prev ? { ...prev, data: { ...prev.data, settings: { ...prev.data.settings, ...patch } } } : prev);
    scheduleSave();
  }, [setDrawing, scheduleSave]);
  const setBgColor = useCallback((c: EditorBgColor) => updateSettings({ bgColor: c }), [updateSettings]);
  const setFps = useCallback((v: number) => updateSettings({ fps: v }), [updateSettings]);

  const { canUndo, canRedo, pushHistory, handleDrawStart, handleDrawEnd, handleUndo, handleRedo } = useUndoRedo({ latestDataRef, setDrawing, scheduleSave });
  const { handleLayerChange, handleCanvasResize, handleLayerVisibilityToggle, handleLayerDuplicate, handleLayerAdd, handleLayerDelete, handleLayerReorder } = useLayers({ setDrawing, setActiveLayerId, scheduleSave, pushHistory, latestDataRef });
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

  // Opération structurelle sur les calques : la sélection flottante est posée d'abord, sinon
  // l'historique capturerait l'état « pixels levés » et l'undo ferait disparaître la sélection.
  const afterCommit = <A extends unknown[]>(fn: (...args: A) => void) => (...args: A) => {
    selectionRef.current.commit();
    fn(...args);
  };

  const handleShowGridToggle = useCallback(() => setShowGrid(v => !v), []);
  const handleMirrorRotationToggle = useCallback(() => setMirrorRotation(v => !v), []);

  const layers = drawing?.data.layers;
  const frames = useMemo(() => frameIds(layers ?? []), [layers]);
  const isPlaying = animationMode && playing && frames.length > 1;
  const { frameId: playedFrameId } = useAnimationPlayback({ frames, fps, playing: isPlaying });
  const shownFrameId = isPlaying ? playedFrameId : activeLayerId;

  const canvasData = useMemo(() => {
    if (!drawing || !animationMode) return drawing?.data ?? FALLBACK_DATA;
    const onionId = isPlaying || !onionSkin ? null : previousFrameId(frames, activeLayerId);
    return { ...drawing.data, layers: animationLayers(drawing.data.layers, { shownId: shownFrameId, onionId }) };
  }, [drawing, animationMode, isPlaying, onionSkin, frames, activeLayerId, shownFrameId]);

  // Pause : on reste sur l'image affichée, qui devient le calque actif.
  const handlePlayingToggle = useCallback(() => {
    if (isPlaying && playedFrameId) setActiveLayerId(playedFrameId);
    setPlaying(!isPlaying);
  }, [isPlaying, playedFrameId, setActiveLayerId]);
  useEditorShortcuts({
    handleUndo: undo,
    handleRedo: redo,
    setTool,
    selectionRef,
    onPlayToggle: animationMode ? handlePlayingToggle : undefined,
  });
  const handleFrameSelect = useCallback((layerId: string) => {
    setPlaying(false);
    setActiveLayerId(layerId);
  }, [setActiveLayerId]);
  const handleAnimationModeToggle = useCallback(() => {
    updateSettings({ animationMode: !animationMode });
    setPlaying(false);
    // Le panneau Calques n'existe pas en mode animation : la timeline le remplace.
    setOpenPanel(p => (p === 'layers' ? null : p));
  }, [animationMode, updateSettings, setOpenPanel]);

  const handleOnionSkinToggle = useCallback(() => setOnionSkin(v => !v), []);

  const symmetry = useMemo<SymmetryConfig>(() => ({
    axis: mirrorAxis,
    rotation: mirrorRotation,
    radialSegments,
  }), [mirrorAxis, mirrorRotation, radialSegments]);

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
    drawingId: drawing.id,
    title: drawing.title,
    canShare: drawing.owner_id !== LOCAL_OWNER && drawing.owner_id === session?.user.id,
    groupName: drawing.group,
    tool,
    onToolChange: setTool,
    canUndo,
    canRedo,
    onUndo: undo,
    onRedo: redo,
    activeLayerId,
    animationMode,
    layers: drawing.data.layers,
    canvasWidth: drawing.data.width,
    canvasHeight: drawing.data.height,
    onCanvasResize: afterCommit(handleCanvasResize),
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

  const activeLayer = drawing.data.layers.find(l => l.id === activeLayerId);
  const currentTool = toolDef(tool);

  return (
    <EditorContext value={editorCtx}>
      <main className={styles.editor}>
        <a className="skip-link" href="#canvas">Aller au canvas</a>
        <ToolDock
          tool={tool}
          onToolChange={setTool}
          brushSize={brushSize}
          onBrushSizeChange={setBrushSize}
          onBack={handleBack}
          mirror={{
            axis: mirrorAxis,
            rotation: mirrorRotation,
            radialSegments,
            onAxisChange: setMirrorAxis,
            onRotationToggle: handleMirrorRotationToggle,
            onRadialSegmentsChange: setRadialSegments,
          }}
          settings={{
            showGrid,
            gridOpacity,
            bgColor,
            onShowGridToggle: handleShowGridToggle,
            onGridOpacityChange: setGridOpacity,
            onBgColorChange: setBgColor,
            animationMode,
            onAnimationModeToggle: handleAnimationModeToggle,
            fps,
            onFpsChange: setFps,
            onionSkin,
            onOnionSkinToggle: handleOnionSkinToggle,
          }}
        />

        <div className={styles.workspace}>
          <Topbar />
          <div
            className={styles.canvasArea}
            data-bg={bgColor}
            style={{ ['--checker-opacity' as string]: String(gridOpacity) } as CSSProperties}
          >
            <span className={cx(styles.corner, styles.cornerTl)} aria-hidden="true" />
            <span className={cx(styles.corner, styles.cornerTr)} aria-hidden="true" />
            <span className={cx(styles.corner, styles.cornerBl)} aria-hidden="true" />
            <span className={cx(styles.corner, styles.cornerBr)} aria-hidden="true" />
            <Canvas
              data={canvasData}
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
              onTwoFingerTap={isPlaying ? undefined : undo}
              hoveredColor={hoveredColor}
              refImage={refImage}
              onDisplaySizeChange={setCanvasDisplaySize}
              showGrid={showGrid}
              selection={selection}
              title={drawing.title}
              readOnly={isPlaying}
            />
          </div>
          {animationMode && (
            <Timeline
              frames={drawing.data.layers}
              currentId={shownFrameId}
              canvasWidth={drawing.data.width}
              canvasHeight={drawing.data.height}
              playing={isPlaying}
              onPlayingToggle={handlePlayingToggle}
              onFrameSelect={handleFrameSelect}
              edit={{
                onFrameReorder: afterCommit(handleLayerReorder),
                atLayerCap: drawing.data.layers.length >= MAX_LAYERS,
                canDelete: drawing.data.layers.length > 1,
                selectedVisible: activeLayer?.visible ?? true,
                onFrameAdd: afterCommit(handleLayerAdd),
                onFrameVisibilityToggle: afterCommit(() => handleLayerVisibilityToggle(activeLayerId)),
                onFrameDuplicate: afterCommit(() => handleLayerDuplicate(activeLayerId)),
                onFrameDelete: afterCommit(() => handleLayerDelete(activeLayerId)),
              }}
            />
          )}
          <StatusBar
            toolLabel={currentTool?.label ?? tool}
            brushSize={currentTool?.sized ? brushSize : undefined}
            layerName={activeLayer?.name ?? '—'}
            mirror={mirrorLabel(mirrorAxis, mirrorRotation, radialSegments)}
            width={drawing.data.width}
            height={drawing.data.height}
            status={status}
          />
        </div>

        <ColorRail
          ref={rightSidebarRef}
          color={color}
          recentColors={displayedRecentColors}
          drawingColors={drawingColors}
          editingColor={editColorMode?.originalColor}
          highlightFirstRecent={isNormalPick}
          pickerOpen={openPanel === 'color' && !editColorMode}
          onPickerToggle={() => handlePanelToggle('color')}
          picker={openPanel === 'color' && !editColorMode && (
            <ColorPanel className={styles.colorPanel} onClose={handlePanelClose}>
              <ColorPicker value={color} onChange={handleColorChange} onColorHover={setHoveredColor} recentColors={displayedRecentColors} drawingColors={drawingColors} />
            </ColorPanel>
          )}
          onColorChange={handleColorChange}
          onEditDrawingColor={afterCommit(handleEditDrawingColor)}
          onHoverEnter={setHoveredColor}
          onHoverLeave={handleHoverLeave}
        />

        {openPanel === 'color' && editColorMode && (
          <ColorPanel
            panelRef={editColorPanelRef}
            className={styles.editColorPanel}
            anchorY={editColorMode.pickerY}
            onClose={handlePanelClose}
          >
            <ColorPicker value={color} onChange={handleColorChange} onColorHover={setHoveredColor} recentColors={displayedRecentColors} drawingColors={drawingColors} />
          </ColorPanel>
        )}

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
