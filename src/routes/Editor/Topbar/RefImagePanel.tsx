import { useRef } from 'react';
import type { ChangeEvent } from 'react';
import { Button } from '@/components/Button';
import { Slider } from '@/components/Slider';
import { useEditorContext } from '../useEditorContext';
import styles from './Topbar.module.scss';

const REF_SCALE_MIN = 0.05;
const REF_SCALE_MAX = 5;
const REF_STEP = 0.01;
const REF_OPACITY_MAX = 1;

/** Popover « Référence » : import, position, zoom, opacité, capture et retrait de l'image. */
export function RefImagePanel() {
  const {
    refImage, refImageError, onRefImageImport, onRefImageErrorClear, onRefImageRemove,
    onRefImageTransform, onRefImageCapture, onPanelClose, canvasDisplaySize,
  } = useEditorContext();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onRefImageImport(file);
    e.target.value = '';
  };

  const displayW = refImage ? refImage.naturalWidth * refImage.scale : 0;
  const displayH = refImage ? refImage.naturalHeight * refImage.scale : 0;

  return (
    <section className={styles.panel} aria-label="Image de référence">
      <h2 className={styles.panelTitle}>Référence</h2>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className={styles.hiddenInput}
        onChange={handleFileChange}
      />

      {!refImage && <span className={styles.refEmpty}>Aucune image</span>}

      {refImageError && (
        <div className={styles.refError} role="alert">
          <span className={styles.refErrorContent}>{refImageError}</span>
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
            onChange={v => onRefImageTransform(v, refImage.y, refImage.scale, refImage.opacity)}
          />
          <Slider
            label="Position Y"
            valueLabel={`${Math.round(refImage.y)} px`}
            min={Math.round(-displayH)}
            max={Math.round(canvasDisplaySize.h)}
            value={Math.round(refImage.y)}
            ariaLabel="Position Y de la référence"
            ariaValueText={`${Math.round(refImage.y)} pixels`}
            onChange={v => onRefImageTransform(refImage.x, v, refImage.scale, refImage.opacity)}
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
            onChange={v => onRefImageTransform(refImage.x, refImage.y, refImage.scale, v)}
          />
          <Button variant="primary" fullWidth onClick={onRefImageCapture}>
            Capturer les pixels
          </Button>
        </>
      )}

      <div className={styles.panelActions}>
        <Button variant="secondary" fullWidth onClick={() => fileInputRef.current?.click()}>
          {refImage ? 'Remplacer l’image' : 'Importer une image'}
        </Button>
        {refImage && (
          <Button variant="ghost" onClick={() => { onRefImageRemove(); onPanelClose(); }}>
            Retirer
          </Button>
        )}
      </div>
    </section>
  );
}
