import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';
import { Button } from '@/components/Button';
import { ColorPicker } from '@/components/ColorPicker';
import type { HexColor, PixelLayer } from '@/types';
import type { Tool } from './Canvas';
import { LayerPanel } from './LayerPanel';
import styles from './Topbar.module.scss';

type OpenPanel = 'layers' | 'color' | 'ref' | null;

interface RefImageInfo {
  x: number;
  y: number;
  scale: number;
  naturalWidth: number;
  naturalHeight: number;
}

interface TopbarProps {
  title: string;
  tool: Tool;
  onToolChange: (t: Tool) => void;
  activeLayerId: string;
  layers: PixelLayer[];
  color: HexColor;
  openPanel: OpenPanel;
  onPanelToggle: (p: 'layers' | 'color' | 'ref') => void;
  onPanelClose: () => void;
  onLayerAdd: () => void;
  onLayerSelect: (id: string) => void;
  onLayerVisibilityToggle: (id: string) => void;
  onLayerDuplicate: (id: string) => void;
  onLayerDelete: (id: string) => void;
  onColorChange: (c: HexColor) => void;
  recentColors: HexColor[];
  drawingColors: HexColor[];
  onBack: () => void;
  refImage: RefImageInfo | null;
  onRefImageImport: (file: File) => void;
  onRefImageRemove: () => void;
  onRefImageTransform: (x: number, y: number, scale: number) => void;
  canvasAreaRef: RefObject<HTMLDivElement>;
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
  onLayerAdd,
  onLayerSelect,
  onLayerVisibilityToggle,
  onLayerDuplicate,
  onLayerDelete,
  onColorChange,
  recentColors,
  drawingColors,
  onBack,
  refImage,
  onRefImageImport,
  onRefImageRemove,
  onRefImageTransform,
  canvasAreaRef,
}: TopbarProps) {
  const topbarRef = useRef<HTMLElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onRefImageImport(file);
    e.target.value = '';
  };

  const containerW = canvasAreaRef.current?.clientWidth ?? 800;
  const containerH = canvasAreaRef.current?.clientHeight ?? 600;
  const displayW = refImage ? refImage.naturalWidth * refImage.scale : 0;
  const displayH = refImage ? refImage.naturalHeight * refImage.scale : 0;
  const xMin = Math.round(-displayW);
  const xMax = Math.round(containerW);
  const yMin = Math.round(-displayH);
  const yMax = Math.round(containerH);

  return (
    <header ref={topbarRef} className={styles.topbar}>
      <Button
        variant="ghost"
        iconOnly
        iconLeft="back"
        aria-label="Retour à la galerie"
      />

      <h1 className={styles.titleText}>{title}</h1>

      <div className={styles.toolGroup}>
        <Button
          variant={tool === 'pencil' ? 'selected' : 'selectable'}
          size="md"
          iconOnly
          iconLeft="pen"
          title="Crayon"
          aria-label="Crayon"
          aria-pressed={tool === 'pencil'}
          onClick={() => onToolChange('pencil')}
        />
        <Button
          variant={tool === 'eraser' ? 'selected' : 'selectable'}
          size="md"
          iconOnly
          iconLeft="erase"
          title="Gomme"
          aria-label="Gomme"
          aria-pressed={tool === 'eraser'}
          onClick={() => onToolChange('eraser')}
        />
        <Button
          variant={tool === 'fill' ? 'selected' : 'selectable'}
          size="md"
          iconOnly
          iconLeft="fill"
          title="Pot de peinture"
          aria-label="Pot de peinture"
          aria-pressed={tool === 'fill'}
          onClick={() => onToolChange('fill')}
        />
        <Button
          variant={tool === 'line' ? 'selected' : 'selectable'}
          size="md"
          iconOnly
          iconLeft="line"
          title="Ligne"
          aria-label="Ligne"
          aria-pressed={tool === 'line'}
          onClick={() => onToolChange('line')}
        />
        <Button
          variant={tool === 'square' ? 'selected' : 'selectable'}
          size="md"
          iconOnly
          iconLeft="rect"
          title="Rectangle"
          aria-label="Rectangle"
          aria-pressed={tool === 'square'}
          onClick={() => onToolChange('square')}
        />
        <Button
          variant={tool === 'circle' ? 'selected' : 'selectable'}
          size="md"
          iconOnly
          iconLeft="circle"
          title="Ellipse"
          aria-label="Ellipse"
          aria-pressed={tool === 'circle'}
          onClick={() => onToolChange('circle')}
        />

        <Button
          variant={openPanel === 'layers' ? 'selected' : 'selectable'}
          size="md"
          className={styles.layersBtn}
          iconOnly
          iconLeft="layers"
          aria-label="Calques"
          aria-expanded={openPanel === 'layers'}
          onClick={() => onPanelToggle('layers')}
        />
        {openPanel === 'layers' && (
          <LayerPanel
            layers={layers}
            activeLayerId={activeLayerId}
            onAdd={onLayerAdd}
            onSelect={id => { onLayerSelect(id); }}
            onVisibilityToggle={onLayerVisibilityToggle}
            onDuplicate={onLayerDuplicate}
            onDelete={onLayerDelete}
          />
        )}

        <Button
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

      <div className={styles.rightSection}>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />
        <div className={styles.refContainer}>
          <Button
            variant={refImage ? 'selected' : 'selectable'}
            size="md"
            iconOnly
            iconLeft="reference"
            title="Image de référence"
            aria-label="Image de référence"
            aria-expanded={openPanel === 'ref'}
            onClick={() => onPanelToggle('ref')}
          />
          {openPanel === 'ref' && (
            <div className={styles.refPanel}>
              <button
                className={styles.refImportBtn}
                onClick={() => fileInputRef.current?.click()}
              >
                Importer une image
              </button>

              {refImage && (
                <>
                  <div className={styles.sliderGroup}>
                    <div className={styles.sliderLabel}>
                      <span>Position X</span>
                      <span className={styles.sliderValue}>{Math.round(refImage.x)} px</span>
                    </div>
                    <input
                      type="range"
                      className={styles.slider}
                      min={xMin}
                      max={xMax}
                      step={1}
                      value={Math.round(refImage.x)}
                      onChange={e =>
                        onRefImageTransform(Number(e.target.value), refImage.y, refImage.scale)
                      }
                    />
                  </div>

                  <div className={styles.sliderGroup}>
                    <div className={styles.sliderLabel}>
                      <span>Position Y</span>
                      <span className={styles.sliderValue}>{Math.round(refImage.y)} px</span>
                    </div>
                    <input
                      type="range"
                      className={styles.slider}
                      min={yMin}
                      max={yMax}
                      step={1}
                      value={Math.round(refImage.y)}
                      onChange={e =>
                        onRefImageTransform(refImage.x, Number(e.target.value), refImage.scale)
                      }
                    />
                  </div>

                  <div className={styles.sliderGroup}>
                    <div className={styles.sliderLabel}>
                      <span>Zoom</span>
                      <span className={styles.sliderValue}>{Math.round(refImage.scale * 100)} %</span>
                    </div>
                    <input
                      type="range"
                      className={styles.slider}
                      min={0.05}
                      max={5}
                      step={0.01}
                      value={refImage.scale}
                      onChange={e => {
                        const newScale = Number(e.target.value);
                        const cx = refImage.x + (refImage.naturalWidth * refImage.scale) / 2;
                        const cy = refImage.y + (refImage.naturalHeight * refImage.scale) / 2;
                        onRefImageTransform(
                          cx - (refImage.naturalWidth * newScale) / 2,
                          cy - (refImage.naturalHeight * newScale) / 2,
                          newScale,
                        );
                      }}
                    />
                  </div>

                  <button
                    className={styles.refRemoveBtn}
                    onClick={() => { onRefImageRemove(); onPanelClose(); }}
                  >
                    Retirer l'image
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
