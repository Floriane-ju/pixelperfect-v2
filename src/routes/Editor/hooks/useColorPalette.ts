import { useCallback, useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import type { DrawingData, DrawingRow, HexColor } from '@/types';

const MAX_RECENT_COLORS = 4;

export type OpenPanel = 'layers' | 'color' | 'ref' | 'export' | null;

interface UseColorPaletteParams {
  drawing: DrawingRow | null;
  setDrawing: React.Dispatch<React.SetStateAction<DrawingRow | null>>;
  scheduleSave: () => void;
  pushHistory: (before: DrawingData) => void;
  latestDataRef: React.MutableRefObject<DrawingData | null>;
  rightSidebarRef: RefObject<HTMLElement>;
}

export function useColorPalette({ drawing, setDrawing, scheduleSave, pushHistory, latestDataRef, rightSidebarRef }: UseColorPaletteParams) {
  const [color, setColor] = useState<HexColor>('#000000');
  const [recentColors, setRecentColors] = useState<HexColor[]>([]);
  const [openPanel, setOpenPanel] = useState<OpenPanel>(null);
  const [hoveredColor, setHoveredColor] = useState<HexColor | null>(null);
  const [contextMenu, setContextMenu] = useState<{ color: HexColor; x: number; y: number } | null>(null);
  const [editColorMode, setEditColorMode] = useState<{ originalColor: HexColor; pickerY: number } | null>(null);
  const [drawingColors, setDrawingColors] = useState<HexColor[]>([]);

  const editColorModeRef = useRef<{ originalColor: HexColor; originalData: DrawingData } | null>(null);
  const editColorPanelRef = useRef<HTMLDivElement>(null);
  const openPanelRef = useRef<OpenPanel>(null);
  const colorRef = useRef<HexColor>(color);

  useEffect(() => { openPanelRef.current = openPanel; }, [openPanel]);

  useEffect(() => {
    if (editColorModeRef.current !== null) return;
    if (!drawing) { setDrawingColors([]); return; }

    const colorCounts = new Map<HexColor, number>();
    for (const layer of drawing.data.layers) {
      for (const c of Object.values(layer.pixels)) {
        colorCounts.set(c, (colorCounts.get(c) ?? 0) + 1);
      }
    }

    setDrawingColors(prev => {
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
    });
  }, [drawing]);

  const handleColorChange = useCallback((newColor: HexColor) => {
    setColor(newColor);
    colorRef.current = newColor;
    const editMode = editColorModeRef.current;
    if (editMode && newColor !== editMode.originalColor) {
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
    }
  }, [setDrawing]);

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
      const c = colorRef.current;
      setRecentColors(recents => {
        const filtered = recents.filter(r => r !== c);
        return [c, ...filtered].slice(0, MAX_RECENT_COLORS);
      });
    }
    setOpenPanel(null);
  }, [pushHistory, scheduleSave]);

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
    setContextMenu(null);
    setOpenPanel('color');
  }, [latestDataRef, handleColorChange]);

  useEffect(() => {
    if (openPanel !== 'color') return;
    const handler = (e: PointerEvent) => {
      const inSidebar = rightSidebarRef.current?.contains(e.target as Node);
      const inEditPanel = editColorPanelRef.current?.contains(e.target as Node);
      if (!inSidebar && !inEditPanel) closeColorPanel();
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
    contextMenu,
    setContextMenu,
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
