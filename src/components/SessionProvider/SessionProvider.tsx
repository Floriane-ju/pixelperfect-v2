import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { updateDrawingData } from '@/lib/drawings';
import { flushAll } from '@/lib/offlineQueue';
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
    } = supabase.auth.onAuthStateChange((_event, s) => {
      settled = true;
      setState({ session: s, loading: false });
    });
    return () => subscription.unsubscribe();
  }, []);

  // La file n'était rejouée qu'à la réouverture du dessin concerné : on la vide à la connexion
  // et au retour du réseau.
  const userId = state.session?.user.id;
  useEffect(() => {
    if (!userId) return;
    const flush = () => { void flushAll(updateDrawingData); };
    if (navigator.onLine) flush();
    window.addEventListener('online', flush);
    return () => window.removeEventListener('online', flush);
  }, [userId]);

  return <SessionContext.Provider value={state}>{children}</SessionContext.Provider>;
}
