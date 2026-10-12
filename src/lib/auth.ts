import { supabase } from './supabase';
import { updateDrawingData } from './drawings';
import { flushAll } from './offlineQueue';

const SIGN_OUT_FLUSH_TIMEOUT_MS = 3000;

export async function signIn(email: string, password: string): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

export async function signOut(): Promise<void> {
  // Dernière chance d'envoyer les modifs hors-ligne : après, plus de session pour les écrire.
  // Plafonné pour qu'un réseau qui ne répond pas ne bloque pas la déconnexion.
  await Promise.race([
    flushAll(updateDrawingData),
    new Promise<void>((resolve) => setTimeout(resolve, SIGN_OUT_FLUSH_TIMEOUT_MS)),
  ]);
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}
