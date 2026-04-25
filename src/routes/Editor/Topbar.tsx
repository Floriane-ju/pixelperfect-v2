import { useEffect, useRef } from 'react';
import { Button } from '@/components/Button';
import { ColorPicker } from '@/components/ColorPicker';
import type { HexColor, PixelLayer } from '@/types';
import { LayerPanel } from './LayerPanel';
import styles from './Topbar.module.scss';

type Tool = 'pencil' | 'eraser' | 'fill';
type OpenPanel = 'layers' | 'color' | null;

interface TopbarProps {
  title: string;
  tool: Tool;
  onToolChange: (t: Tool) => void;
  activeLayerId: string;
  layers: PixelLayer[];
  color: HexColor;
  openPanel: OpenPanel;
  onPanelToggle: (p: 'layers' | 'color') => void;
  onPanelClose: () => void;
  onLayerSelect: (id: string) => void;
  onLayerVisibilityToggle: (id: string) => void;
  onLayerDuplicate: (id: string) => void;
  onLayerDelete: (id: string) => void;
  onColorChange: (c: HexColor) => void;
  recentColors: HexColor[];
  drawingColors: HexColor[];
  onBack: () => void;
}

export function Topbar({
  title,
  tool,
  onToolChange,
  activeLayerId,
  layers,
  color,
  openPanel,
  onPanelToggle,
  onPanelClose,
  onLayerSelect,
  onLayerVisibilityToggle,
  onLayerDuplicate,
  onLayerDelete,
  onColorChange,
  recentColors,
  drawingColors,
  onBack,
}: TopbarProps) {
  const topbarRef = useRef<HTMLElement>(null);
  const activeLayer = layers.find(l => l.id === activeLayerId);

  // Close panel on outside pointer
  useEffect(() => {
    if (!openPanel) return;
    const handler = (e: PointerEvent) => {
      if (topbarRef.current && !topbarRef.current.contains(e.target as Node)) {
        onPanelClose();
      }
    };
    document.addEventListener('pointerdown', handler);
    return () => document.removeEventListener('pointerdown', handler);
  }, [openPanel, onPanelClose]);

  return (
    <header ref={topbarRef} className={styles.topbar}>
      <Button variant="ghost" size="sm" onClick={onBack}>
        ← Galerie
      </Button>

      <span className={styles.titleText}>{title}</span>

      <div className={styles.toolGroup}>
        <Button
          variant={tool === 'pencil' ? 'primary' : 'ghost'}
          size="sm"
          title="Crayon"
          aria-label="Crayon"
          aria-pressed={tool === 'pencil'}
          onClick={() => onToolChange('pencil')}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
          </svg>
        </Button>
        <Button
          variant={tool === 'eraser' ? 'primary' : 'ghost'}
          size="sm"
          title="Gomme"
          aria-label="Gomme"
          aria-pressed={tool === 'eraser'}
          onClick={() => onToolChange('eraser')}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 20H7L3 16l11-11 6 6-4 4" />
            <path d="M6.0001 11.0001L13 18" />
          </svg>
        </Button>
        <Button
          variant={tool === 'fill' ? 'primary' : 'ghost'}
          size="sm"
          title="Pot de peinture"
          aria-label="Pot de peinture"
          aria-pressed={tool === 'fill'}
          onClick={() => onToolChange('fill')}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m19 11-8-8-8.5 8.5a5.5 5.5 0 0 0 7.78 7.78L19 11Z" />
            <path d="m5 2 5 5" />
            <path d="M2 13h15" />
            <path d="M22 20a2 2 0 1 1-4 0c0-1.6 1.7-2.4 2-4 .3 1.6 2 2.4 2 4Z" />
          </svg>
        </Button>
      </div>

      <div className={styles.right}>
        {/* Layer panel anchor */}
        <div className={styles.panelAnchor}>
          <Button
            variant={openPanel === 'layers' ? 'primary' : 'ghost'}
            size="sm"
            aria-label="Calques"
            aria-expanded={openPanel === 'layers'}
            onClick={() => onPanelToggle('layers')}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="12 2 2 7 12 12 22 7 12 2" />
              <polyline points="2 17 12 22 22 17" />
              <polyline points="2 12 12 17 22 12" />
            </svg>
            <span className={styles.layerName}>{activeLayer?.name ?? 'Calques'}</span>
          </Button>
          {openPanel === 'layers' && (
            <LayerPanel
              layers={layers}
              activeLayerId={activeLayerId}
              onSelect={id => { onLayerSelect(id); }}
              onVisibilityToggle={onLayerVisibilityToggle}
              onDuplicate={onLayerDuplicate}
              onDelete={onLayerDelete}
            />
          )}
        </div>

        {/* Color picker anchor */}
        <div className={styles.panelAnchor}>
          <button
            className={styles.colorSwatch}
            style={{ background: color }}
            title="Couleur"
            aria-label="Choisir une couleur"
            aria-expanded={openPanel === 'color'}
            onClick={() => onPanelToggle('color')}
          />
          {openPanel === 'color' && (
            <div className={styles.colorPanel}>
              <ColorPicker
                value={color}
                onChange={onColorChange}
                recentColors={recentColors}
                drawingColors={drawingColors}
              />
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
