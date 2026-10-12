import { useEffect, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { fetchDrawing } from '@/lib/drawingStore';
import { LOCAL_OWNER } from '@/lib/localLibrary';
import { dequeue, getPendingEntry } from '@/lib/offlineQueue';
import type { DrawingRow } from '@/types';

export type EditorStatus = 'loading' | 'ready' | 'error' | 'saving';

export interface UseEditorDrawingReturn {
  drawing: DrawingRow | null;
  setDrawing: Dispatch<SetStateAction<DrawingRow | null>>;
  status: EditorStatus;
  setStatus: Dispatch<SetStateAction<EditorStatus>>;
  activeLayerId: string;
  setActiveLayerId: Dispatch<SetStateAction<string>>;
}

/** Charge le dessin de la route et suit le calque actif. */
export function useEditorDrawing(id: string | undefined): UseEditorDrawingReturn {
  const [drawing, setDrawing] = useState<DrawingRow | null>(null);
  const [status, setStatus] = useState<EditorStatus>('loading');
  const [selectedLayerId, setActiveLayerId] = useState<string>('');

  // Un undo/redo ou une suppression peut retirer le calque sélectionné : on retombe alors sur le
  // calque du dessus plutôt que de dessiner dans un calque inexistant (traits perdus).
  const layers = drawing?.data.layers;
  const activeLayerId = !layers || layers.some(l => l.id === selectedLayerId)
    ? selectedLayerId
    : (layers[layers.length - 1]?.id ?? '');

  // Changement de dessin : on repart d'un état de chargement dès ce rendu (pas d'effet en cascade).
  const [loadedId, setLoadedId] = useState(id);
  if (id !== loadedId) {
    setLoadedId(id);
    setDrawing(null);
    setStatus('loading');
  }

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    fetchDrawing(id)
      .then(async row => {
        if (row.owner_id === LOCAL_OWNER) return row;
        // Modifs hors-ligne pas encore synchronisées : elles priment sur la version serveur, sinon
        // l'éditeur afficherait l'ancienne version et le prochain autosave écraserait la file.
        // Sauf si le serveur a été modifié après la mise en file (envoi réussi dont le retrait
        // n'a pas abouti, ou édition depuis un autre appareil) : l'entrée est alors périmée.
        const entry = await getPendingEntry(row.id);
        if (!entry) return row;
        if (entry.savedAt !== null && Date.parse(row.updated_at) >= entry.savedAt) {
          await dequeue(row.id);
          return row;
        }
        return { ...row, data: entry.data };
      })
      .then(row => {
        if (cancelled) return;
        setDrawing(row);
        const visibleLayers = row.data.layers.filter(l => l.visible);
        const topmost = visibleLayers[visibleLayers.length - 1] ?? row.data.layers[row.data.layers.length - 1];
        setActiveLayerId(topmost?.id ?? '');
        setStatus('ready');
      })
      .catch(() => { if (!cancelled) setStatus('error'); });
    return () => { cancelled = true; };
  }, [id]);

  return { drawing, setDrawing, status, setStatus, activeLayerId, setActiveLayerId };
}
