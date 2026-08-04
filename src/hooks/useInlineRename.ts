import { useCallback, useRef, useState } from 'react';
import type { ChangeEvent, KeyboardEvent, RefObject } from 'react';

export interface UseInlineRenameParams {
  /** Nom affiché actuellement : sert de valeur initiale et de référence de comparaison. */
  currentName: string;
  onRename?: (nextName: string) => void;
  /** Renommage abandonné si le nom est déjà pris (cas des groupes). */
  isTaken?: (nextName: string) => boolean;
}

export interface UseInlineRenameReturn {
  isRenaming: boolean;
  start: () => void;
  cancel: () => void;
  inputProps: {
    ref: RefObject<HTMLInputElement>;
    value: string;
    onChange: (e: ChangeEvent<HTMLInputElement>) => void;
    onKeyDown: (e: KeyboardEvent<HTMLInputElement>) => void;
    onBlur: () => void;
  };
}

/** Renommage en place d'une carte : état du champ, validation et raccourcis Entrée/Échap. */
export function useInlineRename({
  currentName,
  onRename,
  isTaken,
}: UseInlineRenameParams): UseInlineRenameReturn {
  const [isRenaming, setIsRenaming] = useState(false);
  const [value, setValue] = useState(currentName);
  const inputRef = useRef<HTMLInputElement>(null);

  const cancel = useCallback(() => setIsRenaming(false), []);

  const start = useCallback(() => {
    setValue(currentName);
    setIsRenaming(true);
    // Le champ n'existe qu'après le rendu suivant.
    setTimeout(() => inputRef.current?.select(), 0);
  }, [currentName]);

  const commit = useCallback(() => {
    const trimmed = value.trim();
    if (trimmed && trimmed !== currentName && !isTaken?.(trimmed)) onRename?.(trimmed);
    setIsRenaming(false);
  }, [value, currentName, isTaken, onRename]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') commit();
      if (e.key === 'Escape') cancel();
    },
    [commit, cancel],
  );

  return {
    isRenaming,
    start,
    cancel,
    inputProps: {
      ref: inputRef,
      value,
      onChange: (e) => setValue(e.target.value),
      onKeyDown: handleKeyDown,
      onBlur: commit,
    },
  };
}
