import type { PixelLayer } from '@/types';

/** Opacité relative de la frame précédente affichée en pelure d'oignon. */
export const ONION_OPACITY = 0.3;

/** Frames de l'animation : calques visibles, du bas (frame 1) vers le haut. */
export function frameIds(layers: PixelLayer[]): string[] {
  return layers.filter(l => l.visible).map(l => l.id);
}

/** Frame précédant `id`, en boucle ; `null` s'il n'y a pas d'autre frame. */
export function previousFrameId(frames: string[], id: string): string | null {
  const i = frames.indexOf(id);
  if (i === -1 || frames.length < 2) return null;
  return frames[(i - 1 + frames.length) % frames.length] ?? null;
}

/**
 * Vue d'affichage : seule `shownId` reste dans son état, `onionId` passe en transparence, le
 * reste est masqué. Les `pixels` gardent leur référence : le canvas recompose sans re-rastériser.
 */
export function animationLayers(
  layers: PixelLayer[],
  { shownId, onionId }: { shownId: string | null; onionId: string | null },
): PixelLayer[] {
  return layers.map(l => {
    if (l.id === shownId) return l;
    if (l.id === onionId) return { ...l, opacity: l.opacity * ONION_OPACITY };
    return { ...l, visible: false };
  });
}
