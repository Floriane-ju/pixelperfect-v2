import { useCallback, useEffect, useRef, useState } from 'react';
import type { Dispatch, MutableRefObject, RefObject, SetStateAction } from 'react';
import type { DrawingData, DrawingRow, HexColor } from '@/types';

const MAX_RECENT_COLORS = 4;

export type OpenPanel = 'layers' | 'color' | 'ref' | 'export' | null;

interface UseColorPaletteParams {
  drawing: DrawingRow | null;
  setDrawing: Dispatch<SetStateAction<DrawingRow | null>>;
  scheduleSave: () => void;
  pushHistory: (before: DrawingData) => void;
  latestDataRef: MutableRefObject<DrawingData | null>;
  rightSidebarRef: RefObject<HTMLElement | null>;
}

export function useColorPalette({ drawing, setDrawing, scheduleSave, pushHistory, latestDataRef, rightSidebarRef }: UseColorPaletteParams) {
  const [color, setColor] = useState<HexColor>('#000000');
  const [recentColors, setRecentColors] = useState<HexColor[]>([]);
  const [openPanel, setOpenPanel] = useState<OpenPanel>(null);
  const [hoveredColor, setHoveredColor] = useState<HexColor | null>(null);
  const [editColorMode, setEditColorMode] = useState<{ originalColor: HexColor; pickerY: number } | null>(null);
  const [drawingColors, setDrawingColors] = useState<HexColor[]>([]);

  const editColorModeRef = useRef<{ originalColor: HexColor; originalData: DrawingData } | null>(null);
  const editColorPanelRef = useRef<HTMLDivElement>(null);
  const openPanelRef = useRef<OpenPanel>(null);
  const colorRef = useRef<HexColor>(color);

  useEffect(() => { openPanelRef.current = openPanel; }, [openPanel]);

  // Palette du dessin recalculée pendant le rendu quand le dessin change (figée en édition de couleur,
  // sinon la couleur éditée sauterait de place à chaque mouvement du sélecteur).
  const [paletteSource, setPaletteSource] = useState<DrawingRow | null>(null);
  if (editColorMode === null && drawing !== paletteSource) {
    setPaletteSource(drawing);
    setDrawingColors(prev => nextDrawingColors(prev, drawing));
  }

  const handleColorChange = useCallback((newColor: HexColor) => {
    setColor(newColor);
    colorRef.current = newColor;
    const editMode = editColorModeRef.current;
    // Toujours reconstruire depuis originalData : revenir à la couleur d'origine doit annuler le rendu précédent.
    if (editMode) {
      const { originalColor, originalData } = editMode;
      setDrawing(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          data: {
            ...originalData,
            layers: originalData.layers.map(l => {
              if (!Object.values(l.pixels).some(c => c === originalColor)) return l;
              const newPixels: Record<string, HexColor> = {};
              for (const [key, c] of Object.entries(l.pixels)) {
                newPixels[key] = c === originalColor ? newColor : c;
              }
              return { ...l, pixels: newPixels };
            }),
          },
        };
      });
      // Sauvegarde programmée dès l'édition : si iOS tue la PWA panneau ouvert, flushImmediate
      // n'a rien à envoyer tant qu'aucun minuteur n'est en cours.
      scheduleSave();
    }
  }, [setDrawing, scheduleSave]);

  const commitRecentColor = useCallback((c: HexColor) => {
    setRecentColors(recents => {
      const filtered = recents.filter(r => r !== c);
      return [c, ...filtered].slice(0, MAX_RECENT_COLORS);
    });
  }, []);

  const closeColorPanel = useCallback(() => {
    const editMode = editColorModeRef.current;
    if (editMode) {
      if (colorRef.current !== editMode.originalColor) {
        pushHistory(editMode.originalData);
        scheduleSave();
      }
      editColorModeRef.current = null;
      setEditColorMode(null);
    } else {
      commitRecentColor(colorRef.current);
    }
    setOpenPanel(null);
  }, [pushHistory, scheduleSave, commitRecentColor]);

  const handlePanelToggle = useCallback((panel: 'layers' | 'color' | 'ref' | 'export') => {
    if (panel === 'color') {
      if (openPanelRef.current === 'color') {
        closeColorPanel();
      } else {
        setOpenPanel('color');
      }
    } else {
      setOpenPanel(prev => prev === panel ? null : panel);
    }
  }, [closeColorPanel]);

  const handleEditDrawingColor = useCallback((c: HexColor, pickerY: number) => {
    editColorModeRef.current = { originalColor: c, originalData: latestDataRef.current! };
    setEditColorMode({ originalColor: c, pickerY });
    handleColorChange(c);
    setOpenPanel('color');
  }, [latestDataRef, handleColorChange]);

  useEffect(() => {
    if (openPanel !== 'color') return;
    const handler = (e: PointerEvent) => {
      if (editColorPanelRef.current?.contains(e.target as Node)) return;
      // En édition de couleur, tout clic hors du panneau ferme (et valide) ;
      // le garde sidebar ne sert qu'au sélecteur normal (clics sur les pastilles).
      if (editColorModeRef.current) { closeColorPanel(); return; }
      if (!rightSidebarRef.current?.contains(e.target as Node)) closeColorPanel();
    };
    document.addEventListener('pointerdown', handler);
    return () => document.removeEventListener('pointerdown', handler);
  }, [openPanel, closeColorPanel, rightSidebarRef]);

  const isNormalPick = openPanel === 'color' && !editColorMode;
  const displayedRecentColors = isNormalPick
    ? [color, ...recentColors.filter(c => c !== color)].slice(0, MAX_RECENT_COLORS)
    : recentColors;

  return {
    color,
    recentColors,
    drawingColors,
    openPanel,
    setOpenPanel,
    hoveredColor,
    setHoveredColor,
    editColorMode,
    editColorPanelRef,
    isNormalPick,
    displayedRecentColors,
    handleColorChange,
    commitRecentColor,
    closeColorPanel,
    handlePanelToggle,
    handleEditDrawingColor,
  };
}

/** Couleurs du dessin : nouvelles en tête, ordre existant conservé, disparues retirées. */
function nextDrawingColors(prev: HexColor[], drawing: DrawingRow | null): HexColor[] {
  if (!drawing) return prev.length === 0 ? prev : [];
  const colorCounts = new Map<HexColor, number>();
  for (const layer of drawing.data.layers) {
    for (const c of Object.values(layer.pixels)) {
      colorCounts.set(c, (colorCounts.get(c) ?? 0) + 1);
    }
  }
  const currentColors = new Set(colorCounts.keys());
  if (prev.length === 0) {
    if (currentColors.size === 0) return prev;
    return Array.from(currentColors).sort((a, b) => (colorCounts.get(b) ?? 0) - (colorCounts.get(a) ?? 0));
  }
  const prevSet = new Set(prev);
  const newColors = Array.from(currentColors).filter(c => !prevSet.has(c));
  const hasRemovals = prev.some(c => !currentColors.has(c));
  if (newColors.length === 0 && !hasRemovals) return prev;
  return [...newColors, ...prev.filter(c => currentColors.has(c))];
}
