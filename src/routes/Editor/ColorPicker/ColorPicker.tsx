import { useCallback, useEffect, useState } from 'react';
import type { CSSProperties, PointerEvent } from 'react';
import type { HexColor } from '@/types';
import styles from './ColorPicker.module.scss';

export interface ColorPickerProps {
  value: HexColor;
  onChange: (color: HexColor) => void;
  recentColors: HexColor[];
  drawingColors: HexColor[];
  onColorHover?: (color: HexColor | null) => void;
}

interface HSV {
  h: number; // [0, 360)
  s: number; // [0, 1]
  v: number; // [0, 1]
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

function hexToHsv(hex: HexColor): HSV {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  const v = max;
  const s = max === 0 ? 0 : d / max;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }
  return { h: h * 360, s, v };
}

function hsvToHex(h: number, s: number, v: number): HexColor {
  const f = (n: number) => {
    const k = (n + h / 60) % 6;
    return v - v * s * Math.max(0, Math.min(k, 4 - k, 1));
  };
  const toHex = (x: number) => Math.round(x * 255).toString(16).padStart(2, '0');
  return `#${toHex(f(5))}${toHex(f(3))}${toHex(f(1))}`;
}

function isValidHex(s: string): s is HexColor {
  return /^#[0-9a-fA-F]{6}$/.test(s);
}

export function ColorPicker({ value, onChange, recentColors, drawingColors, onColorHover }: ColorPickerProps) {
  const [hsv, setHsv] = useState<HSV>(() => hexToHsv(value));
  const [hexInput, setHexInput] = useState<string>(value);

  // Sync incoming value when it changes externally (e.g. swatch click)
  useEffect(() => {
    setHsv(hexToHsv(value));
    setHexInput(value);
  }, [value]);

  const applyHsv = useCallback((next: HSV) => {
    setHsv(next);
    const hex = hsvToHex(next.h, next.s, next.v);
    setHexInput(hex);
    onChange(hex);
  }, [onChange]);

  /** Saturation/valeur depuis la position du pointeur dans le carré. */
  const pickSv = useCallback((e: PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    applyHsv({
      ...hsv,
      s: clamp01((e.clientX - rect.left) / rect.width),
      v: clamp01(1 - (e.clientY - rect.top) / rect.height),
    });
  }, [hsv, applyHsv]);

  /** Teinte depuis la position du pointeur dans le rail. */
  const pickHue = useCallback((e: PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    applyHsv({ ...hsv, h: clamp01((e.clientX - rect.left) / rect.width) * 360 });
  }, [hsv, applyHsv]);

  const startCapture = (e: PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handleHexChange = (raw: string) => {
    const normalized = raw.startsWith('#') ? raw : `#${raw}`;
    setHexInput(normalized);
    if (isValidHex(normalized)) {
      setHsv(hexToHsv(normalized));
      onChange(normalized);
    }
  };

  const currentHex = hsvToHex(hsv.h, hsv.s, hsv.v);

  const renderSwatches = (label: string, colors: HexColor[], withHover: boolean) => (
    <div className={styles.section}>
      <span className={styles.sectionLabel}>{label}</span>
      <div className={styles.swatches}>
        {colors.map(c => (
          <button
            key={c}
            type="button"
            className={styles.swatch}
            style={{ background: c }}
            title={c}
            aria-label={`Choisir ${c}`}
            onClick={() => onChange(c)}
            onPointerEnter={withHover ? () => onColorHover?.(c) : undefined}
            onPointerLeave={withHover ? () => onColorHover?.(null) : undefined}
          />
        ))}
      </div>
    </div>
  );

  return (
    <div className={styles.picker}>
      <div
        className={styles.svSquare}
        style={{ '--hue-deg': `${hsv.h}deg` } as CSSProperties}
        onPointerDown={(e) => { startCapture(e); pickSv(e); }}
        onPointerMove={(e) => { if (e.buttons !== 0) pickSv(e); }}
      >
        <div className={styles.svWhite} />
        <div className={styles.svBlack} />
        <div
          className={styles.cursor}
          style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%` }}
        />
      </div>

      <div
        className={styles.hueSlider}
        onPointerDown={(e) => { startCapture(e); pickHue(e); }}
        onPointerMove={(e) => { if (e.buttons !== 0) pickHue(e); }}
      >
        <div
          className={styles.hueThumb}
          style={{
            left: `${(hsv.h / 360) * 100}%`,
            background: hsvToHex(hsv.h, 1, 1),
          }}
        />
      </div>

      <div className={styles.hexRow}>
        <div className={styles.preview} style={{ background: currentHex }} />
        <input
          className={styles.hexInput}
          type="text"
          value={hexInput}
          onChange={e => handleHexChange(e.target.value)}
          spellCheck={false}
          maxLength={7}
          aria-label="Couleur hexadécimale"
        />
      </div>

      {drawingColors.length > 0 && renderSwatches('Couleurs du dessin', drawingColors, true)}
      {recentColors.length > 0 && renderSwatches('Couleurs récentes', recentColors, false)}
    </div>
  );
}
