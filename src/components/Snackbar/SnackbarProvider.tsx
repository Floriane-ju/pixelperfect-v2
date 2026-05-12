import { createContext, useCallback, useMemo, useState, type ReactNode } from 'react';
import type { IconName } from '@/components/Icons';
import { Snackbar } from './Snackbar';

interface SnackbarItem {
  id: number;
  message: string;
  icon?: IconName;
  duration?: number;
}

export interface ShowSnackbarOptions {
  icon?: IconName;
  duration?: number;
}

export interface SnackbarContextValue {
  show: (message: string, options?: ShowSnackbarOptions) => void;
}

export const SnackbarContext = createContext<SnackbarContextValue | null>(null);

interface Props {
  children: ReactNode;
}

export function SnackbarProvider({ children }: Props) {
  const [current, setCurrent] = useState<SnackbarItem | null>(null);

  const show = useCallback((message: string, options?: ShowSnackbarOptions) => {
    setCurrent({
      id: Date.now(),
      message,
      icon: options?.icon,
      duration: options?.duration,
    });
  }, []);

  const value = useMemo<SnackbarContextValue>(() => ({ show }), [show]);

  return (
    <SnackbarContext.Provider value={value}>
      {children}
      {current && (
        <Snackbar
          key={current.id}
          message={current.message}
          icon={current.icon}
          duration={current.duration}
          onClose={() => setCurrent(null)}
        />
      )}
    </SnackbarContext.Provider>
  );
}
