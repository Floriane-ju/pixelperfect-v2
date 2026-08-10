import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { SessionContext, type SessionState } from './SessionContext';

interface SessionProviderProps {
  children: ReactNode;
}

export function SessionProvider({ children }: SessionProviderProps) {
  const [state, setState] = useState<SessionState>({ session: null, loading: true });

  useEffect(() => {
    supabase.auth
      .getSession()
      .then(({ data }) => setState({ session: data.session, loading: false }))
      .catch(() => setState({ session: null, loading: false }));
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => setState({ session: s, loading: false }));
    return () => subscription.unsubscribe();
  }, []);

  return <SessionContext.Provider value={state}>{children}</SessionContext.Provider>;
}
