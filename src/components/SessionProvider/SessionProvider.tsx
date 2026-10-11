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
    let settled = false;
    // Un rejet laisserait `loading` à true indéfiniment (galerie bloquée sur « Chargement… »).
    supabase.auth
      .getSession()
      .then(({ data }) => data.session, () => null)
      .then((session) => {
        // onAuthStateChange a pu répondre d'abord avec un état plus récent.
        if (!settled) setState({ session, loading: false });
      });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => {
      settled = true;
      setState({ session: s, loading: false });
    });
    return () => subscription.unsubscribe();
  }, []);

  return <SessionContext.Provider value={state}>{children}</SessionContext.Provider>;
}
