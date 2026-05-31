import { useContext } from 'react';
import { SessionContext, type SessionState } from './SessionContext';

export function useSession(): SessionState {
  return useContext(SessionContext);
}
