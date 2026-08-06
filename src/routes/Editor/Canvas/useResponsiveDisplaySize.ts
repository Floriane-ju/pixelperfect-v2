import { useEffect, useRef, useState } from 'react';
import type { MutableRefObject, RefObject } from 'react';

interface UseResponsiveDisplaySizeReturn {
  displaySize: { w: number; h: number };
  displaySizeRef: MutableRefObject<{ w: number; h: number }>;
}

export function useResponsiveDisplaySize(
  wrapperRef: RefObject<HTMLElement | null>,
  dataWidth: number,
  dataHeight: number,
  onChange?: (size: { w: number; h: number }) => void,
): UseResponsiveDisplaySizeReturn {
  const [displaySize, setDisplaySize] = useState({ w: 256, h: 256 });
  const displaySizeRef = useRef({ w: 256, h: 256 });

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const observer = new ResizeObserver(entries => {
      const rect = entries[0]?.contentRect;
      if (!rect) return;
      const s = Math.min((rect.width * 0.9) / dataWidth, (rect.height * 0.9) / dataHeight);
      const ds = { w: Math.floor(dataWidth * s), h: Math.floor(dataHeight * s) };
      displaySizeRef.current = ds;
      setDisplaySize(ds);
      onChange?.(ds);
    });
    observer.observe(wrapper);
    return () => observer.disconnect();
  }, [wrapperRef, dataWidth, dataHeight, onChange]);

  return { displaySize, displaySizeRef };
}
