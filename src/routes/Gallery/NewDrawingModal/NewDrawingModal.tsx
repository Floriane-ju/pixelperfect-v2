import { useRef, useState } from 'react';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { useModalA11y } from '@/hooks/useModalA11y';
import styles from './NewDrawingModal.module.scss';

interface Preset {
  label: string;
  width: number;
  height: number;
}

const PRESETS: Preset[] = [
  { label: '12 × 12', width: 12, height: 12 },
  { label: '24 × 24', width: 24, height: 24 },
  { label: '32 × 32', width: 32, height: 32 },
  { label: '54 × 54', width: 54, height: 54 },
];

type SizeMode = 'preset' | 'custom';

export interface NewDrawingModalProps {
  onClose: () => void;
  onConfirm: (name: string, width: number, height: number) => Promise<void>;
}

export function NewDrawingModal({ onClose, onConfirm }: NewDrawingModalProps) {
  const [name, setName] = useState('Sans titre');
  const [sizeMode, setSizeMode] = useState<SizeMode>('preset');
  const [selectedPreset, setSelectedPreset] = useState(0);
  const [customWidth, setCustomWidth] = useState('32');
  const [customHeight, setCustomHeight] = useState('32');
  const [isCreating, setIsCreating] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const nameRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  useModalA11y({ modalRef, onClose, initialFocusRef: nameRef });

  const parseDimension = (value: string, fallback: number): number => {
    const n = parseInt(value, 10);
    return Number.isFinite(n) && n > 0 ? Math.max(8, Math.min(n, 512)) : fallback;
  };

  const handleSubmit = async () => {
    const trimmed = name.trim() || 'Sans titre';
    let width: number;
    let height: number;

    if (sizeMode === 'preset') {
      const preset = PRESETS[selectedPreset];
      if (!preset) return;
      width = preset.width;
      height = preset.height;
    } else {
      width = parseDimension(customWidth, 32);
      height = parseDimension(customHeight, 32);
    }

    setIsCreating(true);
    setErrorMsg('');
    try {
      await onConfirm(trimmed, width, height);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Erreur lors de la création');
      setIsCreating(false);
    }
  };

  return (
    <div className={styles.overlay} onPointerDown={onClose}>
      <div
        ref={modalRef}
        className={styles.modal}
        onPointerDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-drawing-title"
      >
        <h2 id="new-drawing-title" className={styles.heading}>
          Nouveau dessin
        </h2>

        <Input
          ref={nameRef}
          id="drawing-name"
          label="Nom"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={80}
          onKeyDown={(e) => { if (e.key === 'Enter') void handleSubmit(); }}
        />

        <div className={styles.field}>
          <span className={styles.label}>Taille</span>
          <div className={styles.presets}>
            {PRESETS.map((p, i) => (
              <button
                key={p.label}
                type="button"
                className={[
                  styles.presetBtn,
                  sizeMode === 'preset' && selectedPreset === i ? styles.presetBtnActive : '',
                ].filter(Boolean).join(' ')}
                onClick={() => { setSizeMode('preset'); setSelectedPreset(i); }}
              >
                {p.label}
              </button>
            ))}
            <button
              type="button"
              className={[
                styles.presetBtn,
                sizeMode === 'custom' ? styles.presetBtnActive : '',
              ].filter(Boolean).join(' ')}
              onClick={() => setSizeMode('custom')}
            >
              Personnalisé
            </button>
          </div>

          {sizeMode === 'custom' && (
            <div className={styles.customRow}>
              <div className={styles.dimensionField}>
                <label className={styles.dimensionLabel} htmlFor="custom-width">L</label>
                <input
                  id="custom-width"
                  className={styles.dimensionInput}
                  type="number"
                  min={1}
                  max={512}
                  value={customWidth}
                  onChange={(e) => setCustomWidth(e.target.value)}
                />
              </div>
              <span className={styles.dimensionSep}>×</span>
              <div className={styles.dimensionField}>
                <label className={styles.dimensionLabel} htmlFor="custom-height">H</label>
                <input
                  id="custom-height"
                  className={styles.dimensionInput}
                  type="number"
                  min={1}
                  max={512}
                  value={customHeight}
                  onChange={(e) => setCustomHeight(e.target.value)}
                />
              </div>
              <span className={styles.dimensionUnit}>px</span>
            </div>
          )}
        </div>

        {errorMsg && (
          <div className={styles.error} role="alert">{errorMsg}</div>
        )}

        <div className={styles.actions}>
          <Button variant="secondary" size="sm" onClick={onClose} disabled={isCreating}>
            Annuler
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => void handleSubmit()}
            disabled={isCreating}
          >
            {isCreating ? 'Création…' : 'Créer'}
          </Button>
        </div>
      </div>
    </div>
  );
}
