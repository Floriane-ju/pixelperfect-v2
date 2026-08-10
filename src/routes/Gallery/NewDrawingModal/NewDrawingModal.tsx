import { useRef, useState } from 'react';
import { Button } from '@/components/Button';
import { Dialog } from '@/components/Dialog';
import { Input } from '@/components/Input';
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

const MIN_SIZE = 8;
const MAX_SIZE = 512;
const DEFAULT_SIZE = 32;

type SizeMode = 'preset' | 'custom';

export interface NewDrawingModalProps {
  onClose: () => void;
  onConfirm: (name: string, width: number, height: number) => Promise<void>;
}

function parseDimension(value: string, fallback: number): number {
  const n = parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? Math.max(MIN_SIZE, Math.min(n, MAX_SIZE)) : fallback;
}

export function NewDrawingModal({ onClose, onConfirm }: NewDrawingModalProps) {
  const [name, setName] = useState('Sans titre');
  const [sizeMode, setSizeMode] = useState<SizeMode>('preset');
  const [selectedPreset, setSelectedPreset] = useState(0);
  const [customWidth, setCustomWidth] = useState(String(DEFAULT_SIZE));
  const [customHeight, setCustomHeight] = useState(String(DEFAULT_SIZE));
  const [isCreating, setIsCreating] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const nameRef = useRef<HTMLInputElement>(null);

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
      width = parseDimension(customWidth, DEFAULT_SIZE);
      height = parseDimension(customHeight, DEFAULT_SIZE);
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
    <Dialog
      title="Nouveau dessin"
      onClose={onClose}
      initialFocusRef={nameRef}
      actions={
        <>
          <Button variant="ghost" size="sm" onClick={onClose} disabled={isCreating}>
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
        </>
      }
    >
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
          {PRESETS.map((p, i) => {
            const isActive = sizeMode === 'preset' && selectedPreset === i;
            return (
              <Button
                key={p.label}
                variant={isActive ? 'selected' : 'selectable'}
                size="sm"
                aria-pressed={isActive}
                onClick={() => { setSizeMode('preset'); setSelectedPreset(i); }}
              >
                {p.label}
              </Button>
            );
          })}
          <Button
            variant={sizeMode === 'custom' ? 'selected' : 'selectable'}
            size="sm"
            aria-pressed={sizeMode === 'custom'}
            onClick={() => setSizeMode('custom')}
          >
            Personnalisé
          </Button>
        </div>

        {sizeMode === 'custom' && (
          <div className={styles.customRow}>
            <Input
              id="custom-width"
              label="L"
              type="number"
              min={MIN_SIZE}
              max={MAX_SIZE}
              value={customWidth}
              onChange={(e) => setCustomWidth(e.target.value)}
              fullWidth={false}
              className={styles.dimensionField}
              inputClassName={styles.dimensionInput}
            />
            <span className={styles.dimensionSep}>×</span>
            <Input
              id="custom-height"
              label="H"
              type="number"
              min={MIN_SIZE}
              max={MAX_SIZE}
              value={customHeight}
              onChange={(e) => setCustomHeight(e.target.value)}
              fullWidth={false}
              className={styles.dimensionField}
              inputClassName={styles.dimensionInput}
            />
            <span className={styles.dimensionUnit}>px</span>
          </div>
        )}
      </div>

      {errorMsg && (
        <div className={styles.error} role="alert">{errorMsg}</div>
      )}
    </Dialog>
  );
}
