import { useRef } from 'react';
import { useModalA11y } from '@/hooks/useModalA11y';
import { Button } from '@/components/Button';
import { Switch } from '@/components/Switch';
import type { MirrorAxis } from '../shapePixels';
import styles from './MirrorPanel.module.scss';

export type RadialSegments = 4 | 8;

export interface MirrorPanelProps {
  axis: MirrorAxis;
  rotation: boolean;
  radialSegments: RadialSegments;
  onAxisChange: (axis: MirrorAxis) => void;
  onRotationToggle: () => void;
  onRadialSegmentsChange: (segments: RadialSegments) => void;
  onClose: () => void;
}

const AXIS_OPTIONS: ReadonlyArray<{ axis: MirrorAxis; icon: 'mirror' | 'mirror-v' | 'radial'; label: string }> = [
  { axis: 'horizontal', icon: 'mirror', label: 'Miroir horizontal' },
  { axis: 'vertical', icon: 'mirror-v', label: 'Miroir vertical' },
  { axis: 'radial', icon: 'radial', label: 'Miroir radial' },
];

const SEGMENT_OPTIONS: ReadonlyArray<RadialSegments> = [4, 8];

export function MirrorPanel({
  axis,
  rotation,
  radialSegments,
  onAxisChange,
  onRotationToggle,
  onRadialSegmentsChange,
  onClose,
}: MirrorPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  useModalA11y({ modalRef: panelRef, onClose, closeOnEscape: true });

  const enabled = axis !== 'none';

  return (
    <div ref={panelRef} className={styles.panel} role="dialog" aria-label="Symétrie">
      <section className={styles.section}>
        <span className={styles.label}>Symétrie</span>
        <div className={styles.options} role="radiogroup" aria-label="Type de symétrie">
          {AXIS_OPTIONS.map(({ axis: a, icon, label }) => (
            <Button
              key={a}
              variant={axis === a ? 'selected' : 'selectable'}
              size="md"
              iconOnly
              iconLeft={icon}
              role="radio"
              aria-checked={axis === a}
              title={label}
              aria-label={label}
              onClick={() => onAxisChange(axis === a ? 'none' : a)}
            />
          ))}
        </div>
      </section>

      {axis === 'radial' && (
        <section className={styles.section}>
          <span className={styles.label}>Réflexions</span>
          <div className={styles.options} role="radiogroup" aria-label="Nombre de réflexions">
            {SEGMENT_OPTIONS.map(n => (
              <Button
                key={n}
                variant={radialSegments === n ? 'selected' : 'selectable'}
                size="sm"
                role="radio"
                aria-checked={radialSegments === n}
                aria-label={`${n} réflexions`}
                onClick={() => onRadialSegmentsChange(n)}
              >
                {n}
              </Button>
            ))}
          </div>
        </section>
      )}

      <div className={styles.row}>
        <span className={styles.label}>Par rotation</span>
        <Switch
          checked={rotation}
          onChange={onRotationToggle}
          disabled={!enabled}
          aria-label="Symétrie par rotation"
        />
      </div>
    </div>
  );
}
