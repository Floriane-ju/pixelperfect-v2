import { useCallback, useState } from 'react';
import type { EditorBgColor } from '../SettingsPanel';
import type { RadialSegments } from '../MirrorPanel';
import type { MirrorAxis } from '../shapePixels';

interface UseDisplayPanelsReturn {
  showMirror: boolean;
  showGrid: boolean;
  showSettings: boolean;
  mirrorAxis: MirrorAxis;
  mirrorRotation: boolean;
  radialSegments: RadialSegments;
  gridOpacity: number;
  bgColor: EditorBgColor;
  handleShowGridToggle: () => void;
  handleSettingsToggle: () => void;
  handleSettingsClose: () => void;
  handleMirrorToggle: () => void;
  handleMirrorClose: () => void;
  handleMirrorRotationToggle: () => void;
  setMirrorAxis: (axis: MirrorAxis) => void;
  setRadialSegments: (segments: RadialSegments) => void;
  setGridOpacity: (opacity: number) => void;
  setBgColor: (color: EditorBgColor) => void;
}

export function useDisplayPanels(): UseDisplayPanelsReturn {
  const [showMirror, setShowMirror] = useState(false);
  const [showGrid, setShowGrid] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [mirrorAxis, setMirrorAxis] = useState<MirrorAxis>('none');
  const [mirrorRotation, setMirrorRotation] = useState(false);
  const [radialSegments, setRadialSegments] = useState<RadialSegments>(4);
  const [gridOpacity, setGridOpacity] = useState(0.4);
  const [bgColor, setBgColor] = useState<EditorBgColor>('white');

  const handleShowGridToggle = useCallback(() => setShowGrid(v => !v), []);
  const handleSettingsToggle = useCallback(() => setShowSettings(v => !v), []);
  const handleSettingsClose = useCallback(() => setShowSettings(false), []);
  const handleMirrorToggle = useCallback(() => setShowMirror(v => !v), []);
  const handleMirrorClose = useCallback(() => setShowMirror(false), []);
  const handleMirrorRotationToggle = useCallback(() => setMirrorRotation(v => !v), []);

  return {
    showMirror,
    showGrid,
    showSettings,
    mirrorAxis,
    mirrorRotation,
    radialSegments,
    gridOpacity,
    bgColor,
    handleShowGridToggle,
    handleSettingsToggle,
    handleSettingsClose,
    handleMirrorToggle,
    handleMirrorClose,
    handleMirrorRotationToggle,
    setMirrorAxis,
    setRadialSegments,
    setGridOpacity,
    setBgColor,
  };
}
