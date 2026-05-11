import { useRef, useState, useEffect } from 'react';
import { Button } from '@/components/Button';
import { LayerPanel } from '@/routes/Editor/LayerPanel/LayerPanel';
import { useEditorContext } from '../EditorContext';
import styles from './Topbar.module.scss';

export function Topbar() {
  const {
    title, tool, onToolChange, canUndo, canRedo, onUndo, onRedo,
    mirrorH, mirrorV, onMirrorHChange, onMirrorVChange,
    activeLayerId, layers, canvasWidth, canvasHeight, openPanel, onPanelToggle, onPanelClose,
    onLayerAdd, onLayerSelect, onLayerVisibilityToggle, onLayerDuplicate, onLayerDelete, onLayerReorder,
    onBack, refImage, refImageError, onRefImageImport, onRefImageErrorClear, onRefImageRemove, onRefImageTransform, onRefImageCapture,
    canvasDisplaySize, onCopySvg,
  } = useEditorContext();

  const topbarRef = useRef<HTMLElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!openPanel || openPanel === 'color') return;
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

  const displayW = refImage ? refImage.naturalWidth * refImage.scale : 0;
  const displayH = refImage ? refImage.naturalHeight * refImage.scale : 0;
  const xMin = Math.round(-displayW);
  const xMax = Math.round(canvasDisplaySize.w);
  const yMin = Math.round(-displayH);
  const yMax = Math.round(canvasDisplaySize.h);

  return (
    <header ref={topbarRef} className={styles.topbar}>
      <div className={styles.leftSection}>
        <Button
          variant="ghost"
          iconOnly
          iconLeft="back"
          aria-label="Retour à la galerie"
          onClick={onBack}
        />
        <h1 className={styles.titleText}>{title}</h1>
      </div>

      <div className={styles.rightSection}>
        <div className={styles.buttonGroup}>
          <Button variant="ghost" size="md" iconOnly iconLeft="undo" title="Annuler (Ctrl+Z)" aria-label="Annuler" disabled={!canUndo} onClick={onUndo} />
          <Button variant="ghost" size="md" iconOnly iconLeft="redo" title="Rétablir (Ctrl+Y)" aria-label="Rétablir" disabled={!canRedo} onClick={onRedo} />
        </div>

        <div className={styles.buttonGroup}>
          <div className={styles.layersContainer}>
            <Button
              variant={openPanel === 'layers' ? 'selected' : 'selectable'}
              size="md"
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
                canvasWidth={canvasWidth}
                canvasHeight={canvasHeight}
                onAdd={onLayerAdd}
                onSelect={id => { onLayerSelect(id); }}
                onVisibilityToggle={onLayerVisibilityToggle}
                onDuplicate={onLayerDuplicate}
                onDelete={onLayerDelete}
                onReorder={onLayerReorder}
              />
            )}
          </div>

          <div className={styles.refContainer}>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />
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

                {refImageError && (
                  <div className={styles.refError} role="alert" onClick={onRefImageErrorClear}>
                    {refImageError}
                  </div>
                )}

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
                          onRefImageTransform(Number(e.target.value), refImage.y, refImage.scale, refImage.opacity)
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
                          onRefImageTransform(refImage.x, Number(e.target.value), refImage.scale, refImage.opacity)
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
                            refImage.opacity,
                          );
                        }}
                      />
                    </div>

                    <div className={styles.sliderGroup}>
                      <div className={styles.sliderLabel}>
                        <span>Opacité</span>
                        <span className={styles.sliderValue}>{Math.round(refImage.opacity * 100)} %</span>
                      </div>
                      <input
                        type="range"
                        className={styles.slider}
                        min={0.05}
                        max={1}
                        step={0.01}
                        value={refImage.opacity}
                        onChange={e =>
                          onRefImageTransform(refImage.x, refImage.y, refImage.scale, Number(e.target.value))
                        }
                      />
                    </div>

                    <button
                      className={styles.refCaptureBtn}
                      onClick={onRefImageCapture}
                    >
                      Capturer les pixels
                    </button>

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

        <div className={styles.buttonGroup}>
          <Button
            variant="selectable"
            size="md"
            iconOnly
            iconLeft={copied ? 'check' : 'export'}
            title="Copier le SVG"
            aria-label="Copier le SVG"
            onClick={() => {
              onCopySvg();
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
          />
        </div>

        <div className={styles.buttonGroup}>
          <Button
            variant={mirrorH ? 'selected' : 'selectable'}
            size="md"
            iconOnly
            iconLeft="mirror"
            title="Miroir horizontal"
            aria-label="Miroir horizontal"
            aria-pressed={mirrorH}
            onClick={() => onMirrorHChange(!mirrorH)}
          />
          <Button
            variant={mirrorV ? 'selected' : 'selectable'}
            size="md"
            iconOnly
            iconLeft="mirror-v"
            title="Miroir vertical"
            aria-label="Miroir vertical"
            aria-pressed={mirrorV}
            onClick={() => onMirrorVChange(!mirrorV)}
          />
        </div>

        <div className={styles.buttonGroup}>
          <Button variant={tool === 'pencil' ? 'selected' : 'selectable'} size="md" iconOnly iconLeft="pen" title="Crayon" aria-label="Crayon" aria-pressed={tool === 'pencil'} onClick={() => onToolChange('pencil')} />
          <Button variant={tool === 'eraser' ? 'selected' : 'selectable'} size="md" iconOnly iconLeft="erase" title="Gomme" aria-label="Gomme" aria-pressed={tool === 'eraser'} onClick={() => onToolChange('eraser')} />
          <Button variant={tool === 'fill' ? 'selected' : 'selectable'} size="md" iconOnly iconLeft="fill" title="Pot de peinture" aria-label="Pot de peinture" aria-pressed={tool === 'fill'} onClick={() => onToolChange('fill')} />
          <Button variant={tool === 'eyedropper' ? 'selected' : 'selectable'} size="md" iconOnly iconLeft="pipette" title="Pipette" aria-label="Pipette" aria-pressed={tool === 'eyedropper'} onClick={() => onToolChange('eyedropper')} />
          <Button variant={tool === 'line' ? 'selected' : 'selectable'} size="md" iconOnly iconLeft="line" title="Ligne" aria-label="Ligne" aria-pressed={tool === 'line'} onClick={() => onToolChange('line')} />
          <Button variant={tool === 'square' ? 'selected' : 'selectable'} size="md" iconOnly iconLeft="rect" title="Rectangle" aria-label="Rectangle" aria-pressed={tool === 'square'} onClick={() => onToolChange('square')} />
          <Button variant={tool === 'circle' ? 'selected' : 'selectable'} size="md" iconOnly iconLeft="circle" title="Ellipse" aria-label="Ellipse" aria-pressed={tool === 'circle'} onClick={() => onToolChange('circle')} />
        </div>
      </div>
    </header>
  );
}
