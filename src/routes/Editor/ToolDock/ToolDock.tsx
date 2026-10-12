import { useCallback, useRef, useState } from 'react';
import { Button } from '@/components/Button';
import { Dock, DockDivider } from '@/components/Dock';
import { useOutsideDismiss } from '@/hooks/useOutsideDismiss';
import { MirrorPanel } from '../MirrorPanel';
import type { MirrorPanelProps } from '../MirrorPanel';
import { SettingsPanel } from '../SettingsPanel';
import type { SettingsPanelProps } from '../SettingsPanel';
import type { Tool } from '../Canvas/Canvas';
import { TOOLS } from '../tools';
import { ToolButton } from './ToolButton';
import styles from './ToolDock.module.scss';

export interface ToolDockProps {
  tool: Tool;
  onToolChange: (tool: Tool) => void;
  brushSize: number;
  onBrushSizeChange: (size: number) => void;
  onBack: () => void;
  mirror: Omit<MirrorPanelProps, 'onClose'>;
  settings: Omit<SettingsPanelProps, 'onClose'>;
}

const MIRROR_ICONS = { none: 'mirror', horizontal: 'mirror', vertical: 'mirror-v', radial: 'radial' } as const;

/** Dock encre de l'éditeur : bibliothèque, outils, symétrie et affichage. */
export function ToolDock({ tool, onToolChange, brushSize, onBrushSizeChange, onBack, mirror, settings }: ToolDockProps) {
  const [sizeOpenFor, setSizeOpenFor] = useState<Tool | null>(null);
  const [showMirror, setShowMirror] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const mirrorRef = useRef<HTMLDivElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);

  const closeMirror = useCallback(() => setShowMirror(false), []);
  const closeSettings = useCallback(() => setShowSettings(false), []);
  useOutsideDismiss({ active: showMirror, refs: [mirrorRef], onDismiss: closeMirror });
  useOutsideDismiss({ active: showSettings, refs: [settingsRef], onDismiss: closeSettings });

  const mirrorOn = mirror.axis !== 'none';

  return (
    <Dock ariaLabel="Outils" version={__APP_VERSION__} className={styles.dock}>
      <Button variant="ink" iconOnly iconLeft="library" aria-label="Bibliothèque" title="Bibliothèque" onClick={onBack} />
      <DockDivider />
      <div className={styles.group} role="group" aria-label="Outils de dessin">
        {TOOLS.map((def) => (
          <ToolButton
            key={def.tool}
            def={def}
            active={tool === def.tool}
            brushSize={brushSize}
            sizeOpen={sizeOpenFor === def.tool}
            onSelect={onToolChange}
            onSizeOpenChange={(open) => setSizeOpenFor(open ? def.tool : null)}
            onBrushSizeChange={onBrushSizeChange}
          />
        ))}
      </div>
      <DockDivider />
      <div ref={mirrorRef} className={styles.slot}>
        <Button
          variant="ink"
          iconOnly
          iconLeft={MIRROR_ICONS[mirror.axis]}
          aria-label={mirrorOn ? 'Symétrie (active)' : 'Symétrie'}
          title="Symétrie"
          aria-expanded={showMirror}
          onClick={() => setShowMirror((v) => !v)}
        />
        {mirrorOn && <span className={styles.dot} aria-hidden="true" />}
        {showMirror && (
          <div className={styles.anchorEnd}>
            <MirrorPanel {...mirror} onClose={closeMirror} />
          </div>
        )}
      </div>
      <div ref={settingsRef} className={styles.slot}>
        <Button
          variant="ink"
          iconOnly
          iconLeft="settings"
          aria-label="Paramètres d'affichage"
          title="Affichage"
          aria-expanded={showSettings}
          onClick={() => setShowSettings((v) => !v)}
        />
        {settings.showGrid && <span className={styles.dot} aria-hidden="true" />}
        {showSettings && (
          <div className={styles.anchorEnd}>
            <SettingsPanel {...settings} onClose={closeSettings} />
          </div>
        )}
      </div>
    </Dock>
  );
}
