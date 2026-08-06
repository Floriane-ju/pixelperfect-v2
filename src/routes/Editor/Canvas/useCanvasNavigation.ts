import { useCallback, useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';

interface Transform { x: number; y: number; scale: number; angle: number; }

const MIN_SCALE = 0.25;
const MAX_SCALE = 48;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

type NavPointerDownResult = 'cancel' | 'pan' | 'draw' | 'skip';

interface NavSnapshot {
  pointers: Map<number, { x: number; y: number }>;
  transform: Transform;
}

export function useCanvasNavigation(wrapperRef: RefObject<HTMLDivElement | null>) {
  const [transform, setTransform] = useState<Transform>({ x: 0, y: 0, scale: 1, angle: 0 });
  const transformRef = useRef<Transform>({ x: 0, y: 0, scale: 1, angle: 0 });
  const navPointers = useRef(new Map<number, { x: number; y: number }>());
  const navSnapshot = useRef<NavSnapshot | null>(null);
  const panLastPos = useRef<{ x: number; y: number } | null>(null);

  const applyTransform = useCallback((t: Transform) => {
    transformRef.current = t;
    setTransform(t);
  }, []);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const wr = wrapper.getBoundingClientRect();
      const wcx = wr.left + wr.width / 2;
      const wcy = wr.top + wr.height / 2;
      const t = transformRef.current;
      const delta = e.ctrlKey ? e.deltaY / 100 : Math.sign(e.deltaY) * 0.15;
      const factor = Math.exp(-delta);
      const newScale = clamp(t.scale * factor, MIN_SCALE, MAX_SCALE);
      const ratio = newScale / t.scale;
      const cx = e.clientX - wcx;
      const cy = e.clientY - wcy;
      applyTransform({ ...t, scale: newScale, x: cx + (t.x - cx) * ratio, y: cy + (t.y - cy) * ratio });
    };
    wrapper.addEventListener('wheel', onWheel, { passive: false });
    return () => wrapper.removeEventListener('wheel', onWheel);
  }, [applyTransform, wrapperRef]);

  const onNavPointerDown = useCallback((id: number, x: number, y: number, button: number, isOnCanvas: boolean): NavPointerDownResult => {
    navPointers.current.set(id, { x, y });

    if (navPointers.current.size >= 2) {
      panLastPos.current = null;
      navSnapshot.current = { pointers: new Map(navPointers.current), transform: { ...transformRef.current } };
      return 'cancel';
    }

    if (button === 1) {
      panLastPos.current = { x, y };
      return 'pan';
    }

    if (button !== 0) return 'skip';

    if (!isOnCanvas) {
      panLastPos.current = { x, y };
      return 'pan';
    }

    return 'draw';
  }, []);

  const onNavPointerMove = useCallback((id: number, x: number, y: number): boolean => {
    navPointers.current.set(id, { x, y });

    if (navPointers.current.size >= 2 && navSnapshot.current) {
      const snap = navSnapshot.current;
      const ids = Array.from(snap.pointers.keys());
      const id0 = ids[0];
      const id1 = ids[1];
      if (id0 === undefined || id1 === undefined) return true;
      const sp0 = snap.pointers.get(id0)!;
      const sp1 = snap.pointers.get(id1)!;
      const cp0 = navPointers.current.get(id0);
      const cp1 = navPointers.current.get(id1);
      if (cp0 && cp1) {
        const wrapper = wrapperRef.current;
        if (!wrapper) return true;
        const wr = wrapper.getBoundingClientRect();
        const wcx = wr.left + wr.width / 2;
        const wcy = wr.top + wr.height / 2;
        const smx = (sp0.x + sp1.x) / 2, smy = (sp0.y + sp1.y) / 2;
        const cmx = (cp0.x + cp1.x) / 2, cmy = (cp0.y + cp1.y) / 2;
        const sdist = Math.hypot(sp1.x - sp0.x, sp1.y - sp0.y);
        const cdist = Math.hypot(cp1.x - cp0.x, cp1.y - cp0.y);
        const angleDelta = (
          Math.atan2(cp1.y - cp0.y, cp1.x - cp0.x) -
          Math.atan2(sp1.y - sp0.y, sp1.x - sp0.x)
        ) * (180 / Math.PI);
        const newScale = clamp(snap.transform.scale * (sdist > 0 ? cdist / sdist : 1), MIN_SCALE, MAX_SCALE);
        const pivotX = smx - wcx - snap.transform.x;
        const pivotY = smy - wcy - snap.transform.y;
        const rad = angleDelta * Math.PI / 180;
        const rotPivotX = pivotX * Math.cos(rad) - pivotY * Math.sin(rad);
        const rotPivotY = pivotX * Math.sin(rad) + pivotY * Math.cos(rad);
        applyTransform({
          x: cmx - wcx - rotPivotX * newScale / snap.transform.scale,
          y: cmy - wcy - rotPivotY * newScale / snap.transform.scale,
          scale: newScale,
          angle: snap.transform.angle + angleDelta,
        });
      }
      return true;
    }

    if (panLastPos.current) {
      const t = transformRef.current;
      applyTransform({ ...t, x: t.x + x - panLastPos.current.x, y: t.y + y - panLastPos.current.y });
      panLastPos.current = { x, y };
      return true;
    }

    return false;
  }, [applyTransform, wrapperRef]);

  const onNavPointerUp = useCallback((id: number): void => {
    navPointers.current.delete(id);
    const remaining = navPointers.current.size;
    if (remaining < 2) {
      const wasNav = navSnapshot.current !== null;
      navSnapshot.current = null;
      if (remaining === 1 && wasNav) {
        const [pos] = navPointers.current.values();
        panLastPos.current = pos ?? null;
      }
    }
    if (remaining === 0) panLastPos.current = null;
  }, []);

  return { transform, transformRef, onNavPointerDown, onNavPointerMove, onNavPointerUp };
}
