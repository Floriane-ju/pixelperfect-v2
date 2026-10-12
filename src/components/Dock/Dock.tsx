import type { ReactNode } from 'react';
import { cx } from '@/lib/cx';
import styles from './Dock.module.scss';

export interface DockProps {
  /** Nom accessible de la navigation. */
  ariaLabel?: string;
  /** Boutons du haut, empilés sous le logo (typiquement `<Button variant="ink" iconOnly>`). */
  children?: ReactNode;
  /** Boutons poussés en bas du dock (en fin de barre sur téléphone). */
  footer?: ReactNode;
  /** Version affichée tout en bas, en Silkscreen. */
  version?: string;
  /** `rail` : reste une colonne sur téléphone (éditeur) ; `responsive` : barre du haut. */
  layout?: DockLayout;
  className?: string;
}

export type DockLayout = 'responsive' | 'rail';

/** Dock encre de 64 px collé à gauche : logo pixel, actions principales, pied. */
export function Dock({
  ariaLabel = 'Navigation',
  children,
  footer,
  version,
  layout = 'responsive',
  className,
}: DockProps) {
  return (
    <nav aria-label={ariaLabel} className={cx(styles.dock, styles[`layout-${layout}`], className)}>
      <span className={styles.logo} aria-hidden="true">
        <span className={styles.logoRed} />
        <span />
        <span className={styles.logoPaper} />
        <span className={styles.logoRed} />
      </span>
      {children}
      {(footer || version) && (
        <div className={styles.footer}>
          {footer}
          {version && <span className={styles.version}>{version}</span>}
        </div>
      )}
    </nav>
  );
}

/** Séparateur court entre deux groupes de boutons du dock. */
export function DockDivider() {
  return <span className={styles.divider} aria-hidden="true" />;
}
