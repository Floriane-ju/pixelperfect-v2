import { useEffect, useState } from 'react';

export interface UseAnimationPlaybackParams {
  frames: string[];
  fps: number;
  playing: boolean;
}

export interface UseAnimationPlaybackReturn {
  /** Frame affichée par la lecture (`null` sans frame). */
  frameId: string | null;
}

export function useAnimationPlayback({ frames, fps, playing }: UseAnimationPlaybackParams): UseAnimationPlaybackReturn {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(() => setTick(t => t + 1), 1000 / fps);
    return () => clearInterval(timer);
  }, [playing, fps]);

  // ponytail: modulo à l'affichage plutôt qu'un reset quand les frames changent.
  return { frameId: frames.length > 0 ? (frames[tick % frames.length] ?? null) : null };
}
