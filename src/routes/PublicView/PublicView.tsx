import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { Link, useParams } from 'react-router';
import { DEFAULT_DRAWING_SETTINGS } from '@/lib/drawingValidation';
import { fetchPublicDrawing, type PublicDrawing } from '@/lib/publicLinks';
import { frameIds } from '@/routes/Editor/animationFrames';
import { useAnimationPlayback } from '@/routes/Editor/hooks/useAnimationPlayback';
import type { DrawingData } from '@/types';
import styles from './PublicView.module.scss';

type State =
  | { status: 'loading' }
  | { status: 'missing' }
  | { status: 'error' }
  | { status: 'ready'; drawing: PublicDrawing };

/** Consultation en lecture seule d'un dessin publié par lien (`/p/:token`), sans connexion. */
export function PublicView() {
  const { token = '' } = useParams<{ token: string }>();
  const [state, setState] = useState<State>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    fetchPublicDrawing(token).then(
      (drawing) => { if (!cancelled) setState(drawing ? { status: 'ready', drawing } : { status: 'missing' }); },
      () => { if (!cancelled) setState({ status: 'error' }); },
    );
    return () => { cancelled = true; };
  }, [token]);

  useEffect(() => {
    if (state.status === 'ready') document.title = `${state.drawing.title} — PixelPerfect`;
  }, [state]);

  return (
    <main className={styles.page}>
      {state.status === 'loading' && <p className={styles.message} role="status">Chargement…</p>}
      {state.status === 'missing' && (
        <p className={styles.message}>Ce lien n’existe pas ou n’est plus partagé.</p>
      )}
      {state.status === 'error' && (
        <p className={styles.message} role="alert">Impossible de charger le dessin. Vérifiez votre connexion.</p>
      )}
      {state.status === 'ready' && (
        <>
          <h1 className={styles.title}>{state.drawing.title}</h1>
          <PublicPreview data={state.drawing.data} />
          <span className={styles.meta}>
            {state.drawing.data.width} × {state.drawing.data.height} px
          </span>
        </>
      )}
      <Link to="/" className={styles.home}>PixelPerfect</Link>
    </main>
  );
}

function PublicPreview({ data }: { data: DrawingData }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { animationMode, fps, bgColor } = { ...DEFAULT_DRAWING_SETTINGS, ...data.settings };
  const frames = useMemo(() => frameIds(data.layers), [data.layers]);
  const { frameId } = useAnimationPlayback({ frames, fps, playing: animationMode && frames.length > 1 });

  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, data.width, data.height);
    // ponytail: redessin complet à chaque frame, suffisant jusqu'à 512² ; pré-rendre les frames si ça saccade.
    for (const layer of data.layers) {
      if (!layer.visible) continue;
      if (animationMode && layer.id !== frameId) continue;
      ctx.globalAlpha = layer.opacity;
      for (const [key, color] of Object.entries(layer.pixels)) {
        const comma = key.indexOf(',');
        ctx.fillStyle = color;
        ctx.fillRect(parseInt(key.slice(0, comma), 10), parseInt(key.slice(comma + 1), 10), 1, 1);
      }
    }
    ctx.globalAlpha = 1;
  }, [data, animationMode, frameId]);

  return (
    <canvas
      ref={canvasRef}
      width={data.width}
      height={data.height}
      className={styles.canvas}
      data-bg={bgColor}
      style={{ '--ratio': data.width / data.height } as CSSProperties}
      role="img"
      aria-label={animationMode ? 'Animation' : 'Dessin'}
    />
  );
}
