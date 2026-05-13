import { createContext } from 'react';
import type { IconName } from '@/components/Icons';

export interface ShowSnackbarOptions {
  icon?: IconName;
  duration?: number;
}

export interface SnackbarContextValue {
  show: (message: string, options?: ShowSnackbarOptions) => void;
}

export const SnackbarContext = createContext<SnackbarContextValue | null>(null);
