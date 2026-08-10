import { useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { Button } from '@/components/Button';
import type { IconName } from '@/components/Icons';
import { Menu } from '@/components/Menu';
import { Slider } from '@/components/Slider';
import { LayerPanel } from '@/routes/Editor/LayerPanel/LayerPanel';
import { useOutsideDismiss } from '@/hooks/useOutsideDismiss';
import type { Tool } from '../Canvas/Canvas';
import { useEditorContext } from '../useEditorContext';
import styles from './Topbar.module.scss';

interface ToolButton {
  tool: Tool;
  icon: IconName;
  label: string;
  /** Infobulle si elle diffère du libellé (raccourci clavier). */
  title?: string;
}

const TOOLS: ToolButton[] = [
  { tool: 'pencil', icon: 'pen', label: 'Crayon' },
  { tool: 'eraser', icon: 'erase', label: 'Gomme' },
  { tool: 'fill', icon: 'fill', label: 'Pot de peinture' },
  { tool: 'eyedropper', icon: 'pipette', label: 'Pipette' },
  { tool: 'select', icon: 'select', label: 'Sélection rectangulaire', title: 'Sélection rectangulaire (S)' },
  { tool: 'line', icon: 'line', label: 'Ligne' },
  { tool: 'square', icon: 'rect', label: 'Rectangle' },
  { tool: 'circle', icon: 'circle', label: 'Ellipse' },
];

const COPIED_FEEDBACK_MS = 2000;
const REF_SCALE_MIN = 0.05;
const REF_SCALE_MAX = 5;
const REF_STEP = 0.01;
const REF_OPACITY_MAX = 1;

export function Topbar() {
  const {
    title, tool, onToolChange, canUndo, canRedo, onUndo, onRedo,
    activeLayerId, layers, canvasWidth, canvasHeight, openPanel, onPanelToggle, onPanelClose,
    onLayerAdd, onLayerSelect, onLayerVisibilityToggle, onLayerDuplicate, onLayerDelete, onLayerReorder,
    onBack, refImage, refImageError, onRefImageImport, onRefImageErrorClear, onRefImageRemove, onRefImageTransform, onRefImageCapture,
    canvasDisplaySize, onCopySvg, onCopyPng,
  } = useEditorContext();

  const topbarRef = useRef<HTMLElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [copied, setCopied] = useState(false);

  const flashCopied = () => {
    setCopied(true);
    setTimeout(() => setCopied(false), COPIED_FEEDBACK_MS);
  };

  // Les panneaux « color » et « export » gèrent leur propre fermeture.
  useOutsideDismiss({
    active: openPanel !== null && openPanel !== 'color' && openPanel !== 'export',
    refs: [topbarRef],
    onDismiss: onPanelClose,
  });

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onRefImageImport(file);
    e.target.value = '';
  };

  const displayW = refImage ? refImage.naturalWidth * refImage.scale : 0;
  const displayH = refImage ? refImage.naturalHeight * refImage.scale : 0;

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
        <div className={styles.titleGroup}>
          <h1 className={styles.titleText}>{title}</h1>
          <span className={styles.titleSize}>{canvasWidth} × {canvasHeight} px</span>
        </div>
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
                onSelect={onLayerSelect}
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
              className={styles.hiddenInput}
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
                <Button
                  variant="ghost"
                  size="sm"
                  fullWidth
                  onClick={() => fileInputRef.current?.click()}
                >
                  Importer une image
                </Button>

                {refImageError && (
                  <div className={styles.refError} role="alert">
                    <div className={styles.refErrorContent}>
                      {refImageError}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      iconOnly
                      iconLeft="close"
                      aria-label="Fermer l'erreur"
                      onClick={onRefImageErrorClear}
                    />
                  </div>
                )}

                {refImage && (
                  <>
                    <Slider
                      label="Position X"
                      valueLabel={`${Math.round(refImage.x)} px`}
                      min={Math.round(-displayW)}
                      max={Math.round(canvasDisplaySize.w)}
                      value={Math.round(refImage.x)}
                      ariaLabel="Position X de la référence"
                      ariaValueText={`${Math.round(refImage.x)} pixels`}
                      onChange={v =>
                        onRefImageTransform(v, refImage.y, refImage.scale, refImage.opacity)
                      }
                    />

                    <Slider
                      label="Position Y"
                      valueLabel={`${Math.round(refImage.y)} px`}
                      min={Math.round(-displayH)}
                      max={Math.round(canvasDisplaySize.h)}
                      value={Math.round(refImage.y)}
                      ariaLabel="Position Y de la référence"
                      ariaValueText={`${Math.round(refImage.y)} pixels`}
                      onChange={v =>
                        onRefImageTransform(refImage.x, v, refImage.scale, refImage.opacity)
                      }
                    />

                    <Slider
                      label="Zoom"
                      valueLabel={`${Math.round(refImage.scale * 100)} %`}
                      min={REF_SCALE_MIN}
                      max={REF_SCALE_MAX}
                      step={REF_STEP}
                      value={refImage.scale}
                      ariaLabel="Zoom de la référence"
                      ariaValueText={`${Math.round(refImage.scale * 100)} pour cent`}
                      onChange={newScale => {
                        // Zoom centré : le centre de l'image reste en place.
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

                    <Slider
                      label="Opacité"
                      valueLabel={`${Math.round(refImage.opacity * 100)} %`}
                      min={REF_SCALE_MIN}
                      max={REF_OPACITY_MAX}
                      step={REF_STEP}
                      value={refImage.opacity}
                      ariaLabel="Opacité de la référence"
                      ariaValueText={`${Math.round(refImage.opacity * 100)} pour cent`}
                      onChange={v =>
                        onRefImageTransform(refImage.x, refImage.y, refImage.scale, v)
                      }
                    />

                    <Button
                      variant="primary"
                      size="sm"
                      fullWidth
                      onClick={onRefImageCapture}
                    >
                      Capturer les pixels
                    </Button>

                    <Button
                      variant="danger"
                      size="sm"
                      fullWidth
                      onClick={() => { onRefImageRemove(); onPanelClose(); }}
                    >
                      Retirer l'image
                    </Button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        <div className={styles.buttonGroup}>
          <div className={styles.exportContainer}>
            <Menu
              ariaLabel="Exporter"
              triggerIcon={copied ? 'check' : 'export'}
              triggerVariant={openPanel === 'export' ? 'selected' : 'selectable'}
              triggerSize="md"
              triggerTitle="Exporter"
              open={openPanel === 'export'}
              onOpenChange={(next) => { if (next) onPanelToggle('export'); else onPanelClose(); }}
              items={[
                { label: 'Copier en SVG', onClick: () => { onCopySvg(); flashCopied(); } },
                { label: 'Copier en PNG', onClick: () => { onCopyPng(); flashCopied(); } },
              ]}
            />
          </div>
        </div>

        <div className={styles.buttonGroup}>
          {TOOLS.map(({ tool: t, icon, label, title: tooltip }) => (
            <Button
              key={t}
              variant={tool === t ? 'selected' : 'selectable'}
              size="md"
              iconOnly
              iconLeft={icon}
              title={tooltip ?? label}
              aria-label={label}
              aria-pressed={tool === t}
              onClick={() => onToolChange(t)}
            />
          ))}
        </div>
      </div>
    </header>
  );
}
