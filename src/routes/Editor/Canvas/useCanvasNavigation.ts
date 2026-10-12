import { useCallback, useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';

export interface Transform { x: number; y: number; scale: number; angle: number; }

const MIN_SCALE = 0.25;
const MAX_SCALE = 48;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

const WHEEL_LINE_PX = 16;
// Tap à deux doigts (= annuler) : bref et quasi immobile, sinon c'est un pinch.
const TWO_FINGER_TAP_MS = 300;
const TWO_FINGER_TAP_SLOP_PX = 10;

/**
 * Bloque le dessin sur le bord du cadre : plus petit que la vue, il reste entièrement
 * visible ; plus grand, il la couvre toujours (pas de vide au-delà de son bord).
 * Raisonne sur la boîte englobante après rotation et zoom.
 */
export function clampToViewport(
  t: Transform,
  size: { w: number; h: number },
  viewport: { w: number; h: number },
): Transform {
  const rad = (t.angle * Math.PI) / 180;
  const cos = Math.abs(Math.cos(rad));
  const sin = Math.abs(Math.sin(rad));
  const halfW = ((size.w * cos + size.h * sin) * t.scale) / 2;
  const halfH = ((size.w * sin + size.h * cos) * t.scale) / 2;
  const limX = Math.abs(viewport.w / 2 - halfW);
  const limY = Math.abs(viewport.h / 2 - halfH);
  return { ...t, x: clamp(t.x, -limX, limX), y: clamp(t.y, -limY, limY) };
}

type NavPointerDownResult = 'cancel' | 'pan' | 'draw' | 'skip';

interface NavSnapshot {
  pointers: Map<number, { x: number; y: number }>;
  transform: Transform;
}

export function useCanvasNavigation(
  wrapperRef: RefObject<HTMLDivElement | null>,
  displaySizeRef: RefObject<{ w: number; h: number }>,
) {
  const [transform, setTransform] = useState<Transform>({ x: 0, y: 0, scale: 1, angle: 0 });
  const transformRef = useRef<Transform>({ x: 0, y: 0, scale: 1, angle: 0 });
  const navPointers = useRef(new Map<number, { x: number; y: number }>());
  const navSnapshot = useRef<NavSnapshot | null>(null);
  const panLastPos = useRef<{ x: number; y: number } | null>(null);
  const twoFingerTap = useRef<{ start: number; valid: boolean } | null>(null);

  const applyTransform = useCallback((t: Transform) => {
    const wrapper = wrapperRef.current;
    const next = wrapper
      ? clampToViewport(t, displaySizeRef.current, { w: wrapper.clientWidth, h: wrapper.clientHeight })
      : t;
    transformRef.current = next;
    setTransform(next);
  }, [wrapperRef, displaySizeRef]);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const t = transformRef.current;
      // Trackpad : le pinch arrive en wheel + ctrlKey (zoom), le glissé à deux doigts en
      // wheel simple (translation). Molette souris : Ctrl/Cmd + molette pour zoomer.
      if (!e.ctrlKey && !e.metaKey) {
        const unit = e.deltaMode === WheelEvent.DOM_DELTA_LINE ? WHEEL_LINE_PX : 1;
        applyTransform({ ...t, x: t.x - e.deltaX * unit, y: t.y - e.deltaY * unit });
        return;
      }
      const wr = wrapper.getBoundingClientRect();
      const wcx = wr.left + wr.width / 2;
      const wcy = wr.top + wr.height / 2;
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
      // Un tap ne compte qu'une seule paire de doigts posée d'un coup (ni 3e doigt, ni reprise).
      if (twoFingerTap.current) twoFingerTap.current.valid = false;
      else twoFingerTap.current = { start: performance.now(), valid: navPointers.current.size === 2 };
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
    // Pointeur en survol (Apple Pencil hover, souris sans clic) : jamais de pointerup, il
    // resterait compté et le prochain doigt déclencherait un faux pinch.
    if (!navPointers.current.has(id)) return true;
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
      const tap = twoFingerTap.current;
      const start = snap.pointers.get(id);
      if (tap && start && Math.hypot(x - start.x, y - start.y) > TWO_FINGER_TAP_SLOP_PX) tap.valid = false;
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

  /** Renvoie `true` quand le dernier doigt d'un tap à deux doigts se lève. */
  const onNavPointerUp = useCallback((id: number): boolean => {
    if (!navPointers.current.has(id)) return false;
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
    if (remaining > 0) return false;
    panLastPos.current = null;
    const tap = twoFingerTap.current;
    twoFingerTap.current = null;
    return !!tap && tap.valid && performance.now() - tap.start <= TWO_FINGER_TAP_MS;
  }, []);

  return { transform, transformRef, onNavPointerDown, onNavPointerMove, onNavPointerUp };
}
