import { useCallback, useMemo, useState, type ReactNode } from 'react';
import type { IconName } from '@/components/Icons';
import { Snackbar } from './Snackbar';
import { SnackbarContext, type ShowSnackbarOptions, type SnackbarContextValue } from './SnackbarContext';

interface SnackbarItem {
  id: number;
  message: string;
  icon?: IconName;
  duration?: number;
}

export interface SnackbarProviderProps {
  children: ReactNode;
}

// Clé React : deux show() dans la même milliseconde doivent quand même relancer le minuteur.
let nextId = 0;

export function SnackbarProvider({ children }: SnackbarProviderProps) {
  const [current, setCurrent] = useState<SnackbarItem | null>(null);

  const show = useCallback((message: string, options?: ShowSnackbarOptions) => {
    setCurrent({
      id: ++nextId,
      message,
      icon: options?.icon,
      duration: options?.duration,
    });
  }, []);

  const close = useCallback(() => setCurrent(null), []);
  const value = useMemo<SnackbarContextValue>(() => ({ show }), [show]);

  return (
    <SnackbarContext value={value}>
      {children}
      {/* Région montée en permanence : les lecteurs d'écran annoncent mal un role=status créé avec son contenu. */}
      <div role="status" aria-live="polite">
        {current && (
          <Snackbar
            key={current.id}
            message={current.message}
            icon={current.icon}
            duration={current.duration}
            onClose={close}
          />
        )}
      </div>
    </SnackbarContext>
  );
}
