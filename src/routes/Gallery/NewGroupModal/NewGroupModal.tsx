import { useRef, useState } from 'react';
import { Button } from '@/components/Button';
import { Dialog } from '@/components/Dialog';
import { Input } from '@/components/Input';

export interface NewGroupModalProps {
  onClose: () => void;
  onConfirm: (groupName: string) => void;
}

export function NewGroupModal({ onClose, onConfirm }: NewGroupModalProps) {
  const [name, setName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onConfirm(trimmed);
  };

  return (
    <Dialog
      title="Nouveau groupe"
      onClose={onClose}
      initialFocusRef={inputRef}
      actions={
        <>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Annuler
          </Button>
          <Button variant="primary" size="sm" onClick={handleSubmit} disabled={!name.trim()}>
            Créer
          </Button>
        </>
      }
    >
      <Input
        ref={inputRef}
        id="group-name"
        label="Nom du groupe"
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={80}
        onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(); }}
      />
    </Dialog>
  );
}
