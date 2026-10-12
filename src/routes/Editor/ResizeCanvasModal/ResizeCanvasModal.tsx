import { useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { Button } from '@/components/Button';
import { Dialog } from '@/components/Dialog';
import { Input } from '@/components/Input';
import { MAX_DIMENSION } from '@/lib/drawingValidation';
import styles from './ResizeCanvasModal.module.scss';

export interface ResizeCanvasModalProps {
  width: number;
  height: number;
  onClose: () => void;
  onConfirm: (width: number, height: number) => void;
}

function parseDimension(value: string): number | null {
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 && n <= MAX_DIMENSION ? n : null;
}

export function ResizeCanvasModal({ width, height, onClose, onConfirm }: ResizeCanvasModalProps) {
  const [w, setW] = useState(String(width));
  const [h, setH] = useState(String(height));
  const widthRef = useRef<HTMLInputElement>(null);

  const nextW = parseDimension(w);
  const nextH = parseDimension(h);
  const valid = nextW !== null && nextH !== null;
  const crops = valid && (nextW < width || nextH < height);

  const handleSubmit = () => {
    if (nextW === null || nextH === null) return;
    onConfirm(nextW, nextH);
  };

  const fieldProps = {
    type: 'number',
    min: 1,
    max: MAX_DIMENSION,
    fullWidth: false,
    className: styles.dimensionField,
    inputClassName: styles.dimensionInput,
    onKeyDown: (e: KeyboardEvent) => { if (e.key === 'Enter') handleSubmit(); },
  } as const;

  return (
    <Dialog
      title="Taille du dessin"
      size="sm"
      onClose={onClose}
      initialFocusRef={widthRef}
      actions={
        <>
          <Button variant="ghost" onClick={onClose}>Annuler</Button>
          <Button variant="primary" size="lg" onClick={handleSubmit} disabled={!valid}>Redimensionner</Button>
        </>
      }
    >
      <div className={styles.row}>
        <Input ref={widthRef} id="resize-width" label="L" value={w} onChange={(e) => setW(e.target.value)} {...fieldProps} />
        <span className={styles.sep}>×</span>
        <Input id="resize-height" label="H" value={h} onChange={(e) => setH(e.target.value)} {...fieldProps} />
        <span className={styles.unit}>1 – {MAX_DIMENSION} px</span>
      </div>
      {crops && <p className={styles.warning}>Les pixels hors du nouveau cadre seront supprimés (annulable).</p>}
    </Dialog>
  );
}
