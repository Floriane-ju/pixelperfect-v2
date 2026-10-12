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
  const zIndexRef = useRef(zIndex);
  // Décalage de cascade figé à l'ouverture.
  const [cascade] = useState(() => (zIndex - Z_MODAL_BASE - 1) % CASCADE_SLOTS);
  const raise = useCallback(() => {
    // next() hors de l'updater : il doit rester pur (rejoué en StrictMode).
    if (zIndexRef.current === Z_MODAL_BASE + counter) return;
    const z = next();
    zIndexRef.current = z;
    setZ(z);
  }, []);
  return {
    zIndex,
    raise,
    initialOffset: { x: cascade * CASCADE_STEP, y: cascade * CASCADE_STEP },
  };
}
