import { useRef, useState } from 'react';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { useModalA11y } from '@/hooks/useModalA11y';
import { addCollaboratorByEmail } from '@/lib/drawings';
import styles from './InviteCollaboratorModal.module.scss';

interface Props {
  drawingId: string;
  drawingTitle: string;
  onClose: () => void;
  onInvited?: (userId: string) => void;
}

type Status = 'idle' | 'pending' | 'success' | 'error';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function InviteCollaboratorModal({ drawingId, drawingTitle, onClose, onInvited }: Props) {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  useModalA11y({ modalRef, onClose, initialFocusRef: inputRef });

  const trimmed = email.trim();
  const isValid = EMAIL_RE.test(trimmed);
  const disabled = !isValid || status === 'pending';

  const handleSubmit = async () => {
    if (!isValid) return;
    setStatus('pending');
    setMessage('');
    try {
      const userId = await addCollaboratorByEmail(drawingId, trimmed);
      onInvited?.(userId);
      setStatus('success');
      setMessage(`${trimmed} ajouté comme contributeur.`);
      setEmail('');
    } catch (err) {
      setStatus('error');
      setMessage(err instanceof Error ? err.message : 'Erreur inconnue.');
    }
  };

  return (
    <div className={styles.overlay} onPointerDown={onClose}>
      <div
        ref={modalRef}
        className={styles.modal}
        onPointerDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="invite-collab-title"
      >
        <h2 id="invite-collab-title" className={styles.heading}>
          Inviter sur «&nbsp;{drawingTitle}&nbsp;»
        </h2>

        <Input
          ref={inputRef}
          id="invite-email"
          label="Email du collaborateur"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => { setEmail(e.target.value); setStatus('idle'); setMessage(''); }}
          maxLength={254}
          onKeyDown={(e) => { if (e.key === 'Enter' && !disabled) void handleSubmit(); }}
        />

        {message && (
          <p className={status === 'error' ? styles.error : styles.success} role="status">
            {message}
          </p>
        )}

        <div className={styles.actions}>
          <Button variant="secondary" size="sm" onClick={onClose}>
            Fermer
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => void handleSubmit()}
            disabled={disabled}
          >
            {status === 'pending' ? 'Envoi…' : 'Inviter'}
          </Button>
        </div>
      </div>
    </div>
  );
}
