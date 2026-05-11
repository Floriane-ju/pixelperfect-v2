import { useEffect, type RefObject } from 'react';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

interface Options {
  modalRef: RefObject<HTMLElement | null>;
  onClose: () => void;
  initialFocusRef?: RefObject<HTMLElement | null>;
}

export function useModalA11y({ modalRef, onClose, initialFocusRef }: Options): void {
  useEffect(() => {
    const previouslyFocused = document.activeElement;
    const explicit = initialFocusRef?.current;
    const fallback = modalRef.current?.querySelector<HTMLElement>(FOCUSABLE) ?? null;
    const target = explicit ?? fallback;
    if (target) {
      target.focus();
      if (target instanceof HTMLInputElement) target.select();
    }
    return () => {
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus();
    };
  }, [modalRef, initialFocusRef]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key !== 'Tab') return;
      const modal = modalRef.current;
      if (!modal) return;
      const focusable = Array.from(modal.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (focusable.length === 0) { e.preventDefault(); return; }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement as HTMLElement | null;
      const insideModal = active ? modal.contains(active) : false;
      if (e.shiftKey && (active === first || !insideModal)) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && (active === last || !insideModal)) {
        e.preventDefault();
        first?.focus();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [modalRef, onClose]);
}
