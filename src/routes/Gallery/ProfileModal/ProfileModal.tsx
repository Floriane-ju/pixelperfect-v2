import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { Modal } from '@/components/Modal';
import { USERNAME_RE, fetchMyProfile, updateUsername } from '@/lib/profiles';
import type { Profile } from '@/types';
import styles from './ProfileModal.module.scss';

interface Props {
  onClose: () => void;
  onUpdated?: (profile: Profile) => void;
}

type Status = 'loading' | 'idle' | 'saving' | 'error';

export function ProfileModal({ onClose, onUpdated }: Props) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [username, setUsername] = useState('');
  const [status, setStatus] = useState<Status>('loading');
  const [message, setMessage] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchMyProfile()
      .then((p) => { setProfile(p); setUsername(p.username); setStatus('idle'); })
      .catch((err: unknown) => {
        setStatus('error');
        setMessage(err instanceof Error ? err.message : 'Erreur inconnue.');
      });
  }, []);

  const normalized = username.trim().toLowerCase();
  const unchanged = profile !== null && normalized === profile.username;
  const isValid = USERNAME_RE.test(normalized);
  const disabled = !isValid || unchanged || status === 'saving' || status === 'loading';

  const handleSubmit = async () => {
    if (disabled) return;
    setStatus('saving');
    setMessage('');
    try {
      const saved = await updateUsername(normalized);
      const updated: Profile = profile ? { ...profile, username: saved } : { user_id: '', username: saved, email: '' };
      setProfile(updated);
      setStatus('idle');
      onUpdated?.(updated);
      onClose();
    } catch (err) {
      setStatus('error');
      setMessage(err instanceof Error ? err.message : 'Erreur inconnue.');
    }
  };

  return (
    <Modal title="Mon profil" onClose={onClose} initialFocusRef={inputRef}>
      {status === 'loading' && (
        <p className={styles.info} role="status">Chargement…</p>
      )}

      {profile && (
        <>
          <div className={styles.row}>
            <span className={styles.fieldLabel}>Email</span>
            <span className={styles.fieldValue}>{profile.email}</span>
          </div>

          <Input
            ref={inputRef}
            id="profile-username"
            label="Pseudo (3-20, minuscules, chiffres, _)"
            type="text"
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            value={username}
            onChange={(e) => { setUsername(e.target.value); setMessage(''); if (status === 'error') setStatus('idle'); }}
            maxLength={20}
            onKeyDown={(e) => { if (e.key === 'Enter' && !disabled) void handleSubmit(); }}
          />
        </>
      )}

      {message && (
        <p className={styles.error} role={status === 'error' ? 'alert' : 'status'}>{message}</p>
      )}

      <div className={styles.actions}>
        <Button
          variant="primary"
          size="sm"
          onClick={() => void handleSubmit()}
          disabled={disabled}
        >
          {status === 'saving' ? 'Enregistrement…' : 'Enregistrer'}
        </Button>
      </div>
    </Modal>
  );
}
