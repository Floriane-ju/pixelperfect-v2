import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
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
  const location = useLocation();
  const rawFrom = (location.state as { from?: { pathname: string } } | null)?.from?.pathname;
  const from = rawFrom && rawFrom.startsWith('/') && !rawFrom.startsWith('//') ? rawFrom : '/';

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate(from, { replace: true });
    });
  }, [from, navigate]);

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

  const locked = lockUntil !== null && Date.now() < lockUntil;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (locked) return;
    setError(null);
    setLoading(true);
    try {
      await signIn(email, password);
      attemptsRef.current = 0;
      navigate(from, { replace: true });
    } catch (err: unknown) {
      // Le message affiché est volontairement générique : sans ce log, une panne
      // d'infra (clé API révoquée, réseau) est indiscernable d'un mauvais mot de passe.
      if (import.meta.env.DEV) console.error('[login]', err);
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

  return (
    <main className={styles.page}>
      <Button
        variant="ghost"
        iconOnly
        iconLeft="back"
        aria-label="Retour"
        className={styles.back}
        onClick={() => navigate(from, { replace: true })}
      />
      <div className={styles.card}>
        <h1 className={styles.title}>Pixel Perfect</h1>
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
          {error && <p id="login-error" className={styles.error} role="alert">{error}</p>}
          <Button type="submit" variant="primary" fullWidth disabled={loading || locked}>
            {locked ? `Réessayez dans ${remaining} s` : loading ? 'Connexion…' : 'Se connecter'}
          </Button>
        </form>
      </div>
    </main>
  );
}
