import { useEffect } from 'react';
import { Icons, type IconName } from '@/components/Icons';
import styles from './Snackbar.module.scss';

export interface SnackbarProps {
  message: string;
  icon?: IconName;
  duration?: number;
  onClose: () => void;
}

const DEFAULT_DURATION = 4000;

export function Snackbar({ message, icon, duration = DEFAULT_DURATION, onClose }: SnackbarProps) {
  useEffect(() => {
    const id = window.setTimeout(onClose, duration);
    return () => window.clearTimeout(id);
  }, [duration, onClose]);

  return (
    <div className={styles.snackbar} role="status" aria-live="polite">
      {icon ? <Icons className={styles.icon} icon={icon} size={20} /> : null}
      <span className={styles.message}>{message}</span>
    </div>
  );
}
