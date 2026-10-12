import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { isAuthApiError } from '@supabase/supabase-js';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { Dock } from '@/components/Dock';
import { signIn } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import styles from './Login.module.scss';

const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 30_000;

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [lockUntil, setLockUntil] = useState<number | null>(null);
  const [remaining, setRemaining] = useState(0);
  const attemptsRef = useRef(0);
  const navigate = useNavigate();

  useEffect(() => {
    // Déjà connecté : retour à la galerie. Ignoré si l'utilisateur est parti entre-temps.
    let ignore = false;
    supabase.auth.getSession().then(
      ({ data }) => {
        if (!ignore && data.session) navigate('/', { replace: true });
      },
      () => {}
    );
    return () => {
      ignore = true;
    };
  }, [navigate]);

  useEffect(() => {
    if (lockUntil === null) return;
    const tick = () => {
      const left = Math.max(0, Math.ceil((lockUntil - Date.now()) / 1000));
      setRemaining(left);
      if (left === 0) {
        setLockUntil(null);
        attemptsRef.current = 0;
        setError(null);
      }
    };
    tick();
    const id = window.setInterval(tick, 500);
    return () => window.clearInterval(id);
  }, [lockUntil]);

  // Le minuteur remet lockUntil à null à l'échéance.
  const locked = lockUntil !== null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (locked) return;
    setError(null);
    setLoading(true);
    try {
      await signIn(email, password);
      attemptsRef.current = 0;
      navigate('/', { replace: true });
    } catch (err: unknown) {
      // Le message affiché est volontairement générique : sans ce log, une panne
      // d'infra (clé API révoquée, réseau) est indiscernable d'un mauvais mot de passe.
      if (import.meta.env.DEV) console.error('[login]', err);
      // Seul un refus d'auth compte pour le verrouillage : une panne réseau ou serveur n'est pas
      // une mauvaise tentative.
      if (!isAuthApiError(err)) {
        setError('Connexion impossible. Vérifiez votre réseau et réessayez.');
        return;
      }
      attemptsRef.current += 1;
      if (attemptsRef.current >= MAX_ATTEMPTS) {
        setLockUntil(Date.now() + LOCKOUT_MS);
        setError(`Trop de tentatives. Réessayez dans ${Math.ceil(LOCKOUT_MS / 1000)} s.`);
      } else {
        setError('Email ou mot de passe incorrect');
      }
    } finally {
      setLoading(false);
    }
  };

  const goToLibrary = () => navigate('/', { replace: true });

  return (
    <div className={styles.page}>
      <Dock version={__APP_VERSION__}>
        <Button
          variant="ink"
          iconOnly
          iconLeft="library"
          aria-label="Bibliothèque"
          title="Bibliothèque"
          onClick={goToLibrary}
        />
      </Dock>
      <main className={styles.main}>
        <Button variant="ghost" iconLeft="back" className={styles.back} onClick={goToLibrary}>
          Retour
        </Button>
        <section className={styles.card} aria-labelledby="login-title">
          <header className={styles.titlebar}>Connexion</header>
          <div className={styles.body}>
            <h1 id="login-title" className={styles.title}>
              <span>Pixel</span>
              <span className={styles.titleLast}>Perfect</span>
            </h1>
            <form className={styles.form} onSubmit={(e) => void handleSubmit(e)}>
              <Input
                id="email"
                label="Email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? 'login-error' : undefined}
              />
              <Input
                id="password"
                label="Mot de passe"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? 'login-error' : undefined}
              />
              {error && (
                <p id="login-error" className={styles.error} role="alert">
                  {error}
                </p>
              )}
              <Button type="submit" variant="primary" fullWidth disabled={loading || locked}>
                {locked ? `Réessayez dans ${remaining} s` : loading ? 'Connexion…' : 'Se connecter'}
              </Button>
            </form>
          </div>
        </section>
      </main>
    </div>
  );
}
