import { useCallback, useRef, useState } from 'react';

const Z_MODAL_BASE = 200;
const CASCADE_STEP = 20;
const CASCADE_SLOTS = 6;
let counter = 0;

function next(): number {
  counter += 1;
  return Z_MODAL_BASE + counter;
}

export function useModalZIndex(): {
  zIndex: number;
  raise: () => void;
  initialOffset: { x: number; y: number };
} {
  const [zIndex, setZ] = useState(next);
  const initialN = useRef<number | null>(null);
  if (initialN.current === null) {
    initialN.current = (zIndex - Z_MODAL_BASE - 1) % CASCADE_SLOTS;
  }
  const raise = useCallback(() => {
    setZ((prev) => {
      const top = Z_MODAL_BASE + counter;
      if (prev === top) return prev;
      return next();
    });
  }, []);
  const n = initialN.current;
  return {
    zIndex,
    raise,
    initialOffset: { x: n * CASCADE_STEP, y: n * CASCADE_STEP },
  };
}
