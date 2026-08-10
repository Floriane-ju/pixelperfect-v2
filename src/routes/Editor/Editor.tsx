import { useEffect, useState } from 'react';
import { useParams } from 'react-router';
import { fetchDrawing } from '@/lib/drawingStore';
import type { DrawingRow } from '@/types';
import { EditorLoading, EditorError } from './EditorStates';
import { EditorReady } from './EditorReady';

type Status = 'loading' | 'ready' | 'error' | 'saving';

export function Editor() {
  const { id } = useParams<{ id: string }>();

  const [drawing, setDrawing] = useState<DrawingRow | null>(null);
  const [status, setStatus] = useState<Status>('loading');

  useEffect(() => {
    if (!id) return;
    setStatus('loading');
    fetchDrawing(id)
      .then(row => {
        setDrawing(row);
        setStatus('ready');
      })
      .catch(() => setStatus('error'));
  }, [id]);

  if (status === 'loading') return <EditorLoading />;
  if (status === 'error' || !drawing) return <EditorError />;

  // `setDrawing` est transmis tel quel : les hooks de l'éditeur attendent déjà cette signature.
  // `drawing` est garanti non nul par le retour anticipé ci-dessus, d'où le type resserré côté
  // `EditorReady` — c'est tout l'intérêt de la séparation.
  return <EditorReady drawing={drawing} setDrawing={setDrawing} id={id} />;
}
