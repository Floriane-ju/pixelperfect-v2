import { useEffect, useId, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { Button } from '@/components/Button';
import { Dialog } from '@/components/Dialog';
import { Input } from '@/components/Input';
import { cx } from '@/lib/cx';
import { addCollaboratorByHandle } from '@/lib/drawings';
import { EMAIL_RE, USERNAME_RE, searchUsersByUsernamePrefix, type UserSuggestion } from '@/lib/profiles';
import styles from './InviteCollaboratorModal.module.scss';

export interface InviteCollaboratorModalProps {
  drawingId: string;
  drawingTitle: string;
  onClose: () => void;
  onInvited?: (userId: string, handle: string) => void;
}

type Status = 'idle' | 'pending' | 'error';

const SUGGEST_MIN_LEN = 3;
const SUGGEST_DEBOUNCE_MS = 200;
/** Laisse le temps au pointerdown d'une suggestion d'aboutir avant de fermer la liste. */
const BLUR_CLOSE_DELAY_MS = 100;
const MAX_HANDLE_LEN = 254;
const USERNAME_PREFIX_RE = /^[a-z0-9_]+$/;

function normalize(input: string): string {
  const trimmed = input.trim();
  return trimmed.startsWith('@') ? trimmed.slice(1) : trimmed;
}

function isValidHandle(value: string): boolean {
  if (value.includes('@')) return EMAIL_RE.test(value);
  return USERNAME_RE.test(value);
}

export function InviteCollaboratorModal({
  drawingId,
  drawingTitle,
  onClose,
  onInvited,
}: InviteCollaboratorModalProps) {
  const [handle, setHandle] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState('');
  const [suggestions, setSuggestions] = useState<UserSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const listboxId = useId();

  const normalized = normalize(handle);
  const isValid = isValidHandle(normalized);
  const disabled = !isValid || status === 'pending';

  useEffect(() => {
    const lower = normalized.toLowerCase();
    if (lower.includes('@') || lower.length < SUGGEST_MIN_LEN || !USERNAME_PREFIX_RE.test(lower)) {
      setSuggestions([]);
      setActiveIndex(-1);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      searchUsersByUsernamePrefix(lower)
        .then((rows) => {
          if (cancelled) return;
          setSuggestions(rows);
          setActiveIndex(rows.length > 0 ? 0 : -1);
        })
        .catch(() => {
          if (cancelled) return;
          setSuggestions([]);
          setActiveIndex(-1);
        });
    }, SUGGEST_DEBOUNCE_MS);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [normalized]);

  const submit = async (handleOverride?: string) => {
    const target = handleOverride ?? normalized;
    if (!isValidHandle(target)) return;
    setStatus('pending');
    setMessage('');
    try {
      const userId = await addCollaboratorByHandle(drawingId, target);
      onInvited?.(userId, target);
      onClose();
    } catch (err) {
      setStatus('error');
      setMessage(err instanceof Error ? err.message : 'Erreur inconnue.');
    }
  };

  const pick = (suggestion: UserSuggestion) => {
    setHandle(suggestion.username);
    setShowSuggestions(false);
    setSuggestions([]);
    setActiveIndex(-1);
    void submit(suggestion.username);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (showSuggestions && suggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex((i) => (i + 1) % suggestions.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setShowSuggestions(false);
        return;
      }
      if (e.key === 'Enter' && activeIndex >= 0) {
        e.preventDefault();
        const picked = suggestions[activeIndex];
        if (picked) pick(picked);
        return;
      }
    }
    if (e.key === 'Enter' && !disabled) {
      void submit();
    }
  };

  const showList = showSuggestions && suggestions.length > 0;

  return (
    <Dialog
      title={<>Inviter sur «&nbsp;{drawingTitle}&nbsp;»</>}
      onClose={onClose}
      initialFocusRef={inputRef}
      actions={
        <>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Fermer
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => void submit()}
            disabled={disabled}
          >
            {status === 'pending' ? 'Envoi…' : 'Inviter'}
          </Button>
        </>
      }
    >
      <div
        className={styles.combobox}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={showList}
        aria-owns={listboxId}
      >
        <Input
          ref={inputRef}
          id="invite-handle"
          label="Pseudo ou email du collaborateur"
          type="text"
          autoComplete="off"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          value={handle}
          aria-autocomplete="list"
          aria-controls={listboxId}
          aria-activedescendant={activeIndex >= 0 ? `${listboxId}-opt-${activeIndex}` : undefined}
          onChange={(e) => {
            setHandle(e.target.value);
            setStatus('idle');
            setMessage('');
            setShowSuggestions(true);
          }}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => { setTimeout(() => setShowSuggestions(false), BLUR_CLOSE_DELAY_MS); }}
          maxLength={MAX_HANDLE_LEN}
          onKeyDown={handleKeyDown}
        />

        {showList && (
          <ul id={listboxId} role="listbox" className={styles.suggestions}>
            {suggestions.map((s, i) => (
              <li
                key={s.user_id}
                id={`${listboxId}-opt-${i}`}
                role="option"
                aria-selected={i === activeIndex}
                className={cx(styles.suggestion, i === activeIndex && styles.suggestionActive)}
                onPointerEnter={() => setActiveIndex(i)}
                onPointerDown={(e) => { e.preventDefault(); pick(s); }}
              >
                @{s.username}
              </li>
            ))}
          </ul>
        )}
      </div>

      {message && (
        <p className={styles.error} role={status === 'error' ? 'alert' : 'status'}>
          {message}
        </p>
      )}
    </Dialog>
  );
}
