import { createContext } from 'react';
import type { Session } from '@supabase/supabase-js';

export interface SessionState {
  session: Session | null;
  loading: boolean;
}

export const SessionContext = createContext<SessionState>({ session: null, loading: true });
