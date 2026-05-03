import { useCallback, useEffect, useRef, useState } from 'react';
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
  const [hexInput, setHexInput] = useState(value);
  const svRef = useRef<HTMLDivElement>(null);
  const hueRef = useRef<HTMLDivElement>(null);

  // Sync incoming value when it changes externally (e.g. swatch click)
  useEffect(() => {
    setHsv(hexToHsv(value));
    setHexInput(value);
  }, [value]);

  const emitColor = useCallback((newHsv: HSV) => {
    const hex = hsvToHex(newHsv.h, newHsv.s, newHsv.v);
    setHexInput(hex);
    onChange(hex);
  }, [onChange]);

  // SV square drag
  const handleSvPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const rect = e.currentTarget.getBoundingClientRect();
    const s = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const v = Math.max(0, Math.min(1, 1 - (e.clientY - rect.top) / rect.height));
    const newHsv = { ...hsv, s, v };
    setHsv(newHsv);
    emitColor(newHsv);
  }, [hsv, emitColor]);

  const handleSvPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.buttons === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const s = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const v = Math.max(0, Math.min(1, 1 - (e.clientY - rect.top) / rect.height));
    const newHsv = { ...hsv, s, v };
    setHsv(newHsv);
    emitColor(newHsv);
  }, [hsv, emitColor]);

  // Hue slider drag
  const handleHuePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const rect = e.currentTarget.getBoundingClientRect();
    const h = Math.max(0, Math.min(360, ((e.clientX - rect.left) / rect.width) * 360));
    const newHsv = { ...hsv, h };
    setHsv(newHsv);
    emitColor(newHsv);
  }, [hsv, emitColor]);

  const handleHuePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.buttons === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const h = Math.max(0, Math.min(360, ((e.clientX - rect.left) / rect.width) * 360));
    const newHsv = { ...hsv, h };
    setHsv(newHsv);
    emitColor(newHsv);
  }, [hsv, emitColor]);

  const handleHexChange = (raw: string) => {
    const normalized = raw.startsWith('#') ? raw : `#${raw}`;
    setHexInput(normalized as HexColor);
    if (isValidHex(normalized)) {
      const newHsv = hexToHsv(normalized);
      setHsv(newHsv);
      onChange(normalized);
    }
  };

  const currentHex = hsvToHex(hsv.h, hsv.s, hsv.v);

  return (
    <div className={styles.picker}>
      {/* SV Square */}
      <div
        ref={svRef}
        className={styles.svSquare}
        style={{ '--hue-deg': `${hsv.h}deg` } as React.CSSProperties}
        onPointerDown={handleSvPointerDown}
        onPointerMove={handleSvPointerMove}
      >
        <div className={styles.svWhite} />
        <div className={styles.svBlack} />
        <div
          className={styles.cursor}
          style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%` }}
        />
      </div>

      {/* Hue slider */}
      <div
        ref={hueRef}
        className={styles.hueSlider}
        onPointerDown={handleHuePointerDown}
        onPointerMove={handleHuePointerMove}
      >
        <div
          className={styles.hueThumb}
          style={{
            left: `${(hsv.h / 360) * 100}%`,
            background: hsvToHex(hsv.h, 1, 1),
          }}
        />
      </div>

      {/* Hex input */}
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

      {/* Drawing colors palette */}
      {drawingColors.length > 0 && (
        <div className={styles.section}>
          <span className={styles.sectionLabel}>Couleurs du dessin</span>
          <div className={styles.swatches}>
            {drawingColors.map(c => (
              <button
                key={c}
                className={styles.swatch}
                style={{ background: c }}
                title={c}
                aria-label={`Choisir ${c}`}
                onClick={() => onChange(c)}
                onMouseEnter={() => onColorHover?.(c)}
                onMouseLeave={() => onColorHover?.(null)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Recent colors */}
      {recentColors.length > 0 && (
        <div className={styles.section}>
          <span className={styles.sectionLabel}>Couleurs récentes</span>
          <div className={styles.swatches}>
            {recentColors.map(c => (
              <button
                key={c}
                className={styles.swatch}
                style={{ background: c }}
                title={c}
                aria-label={`Choisir ${c}`}
                onClick={() => onChange(c)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
