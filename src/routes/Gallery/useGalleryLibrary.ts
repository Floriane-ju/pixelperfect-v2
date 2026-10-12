import { useEffect, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { useSnackbar } from '@/components/Snackbar';
import { fetchDrawings, renameDrawing, deleteDrawing, removeFromGroup, moveToGroup, renameGroup, dissolveGroup } from '@/lib/drawingStore';
import type { DrawingRow } from '@/types';

type Status = 'idle' | 'loading' | 'error';

export interface UseGalleryLibraryParams {
  isAuth: boolean;
  sessionLoading: boolean;
  currentUserId: string;
}

export interface UseGalleryLibraryReturn {
  drawings: DrawingRow[];
  setDrawings: Dispatch<SetStateAction<DrawingRow[]>>;
  status: Status;
  errorMsg: string;
  reload: () => void;
  refetchSilent: () => void;
  handleCollaboratorRemoved: (drawingId: string) => void;
  handleRename: (id: string, newTitle: string) => void;
  handleDelete: (id: string) => void;
  handleRemoveFromGroup: (id: string) => void;
  handleGroupPair: (sourceId: string, targetId: string, groupName: string) => void;
  handleUngroupAll: (groupName: string) => void;
  /** Renvoie false si le renommage est refusé (nom vide, identique ou déjà pris). */
  handleRenameGroup: (oldName: string, newName: string) => boolean;
  handleDeleteGroup: (groupName: string) => void;
  handleMoveToGroup: (drawingId: string, groupName: string) => void;
}

/** Bibliothèque de la galerie : chargement par identité et mutations optimistes. */
export function useGalleryLibrary({
  isAuth,
  sessionLoading,
  currentUserId,
}: UseGalleryLibraryParams): UseGalleryLibraryReturn {
  const snackbar = useSnackbar();
  const [drawings, setDrawings] = useState<DrawingRow[]>([]);
  const [status, setStatus] = useState<Status>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  /** Génération courante : identité, relecture ou mutation optimiste. */
  const fetchGenRef = useRef(0);

  // Nouvelle identité (login/logout) ou rechargement demandé : liste vidée dès ce rendu.
  const loadKey = sessionLoading ? null : `${isAuth}:${reloadKey}`;
  const [prevLoadKey, setPrevLoadKey] = useState(loadKey);
  if (loadKey !== prevLoadKey) {
    setPrevLoadKey(loadKey);
    if (loadKey !== null) {
      setDrawings([]);
      setStatus('loading');
    }
  }

  // Recharge la bibliothèque à chaque changement d'auth (login/logout) une fois la session résolue.
  useEffect(() => {
    if (sessionLoading) return;
    // Une réponse de l'identité précédente (fetch lent) ne doit pas écraser la nouvelle.
    let cancelled = false;
    fetchGenRef.current += 1;
    fetchDrawings()
      .then((rows) => {
        if (cancelled) return;
        setDrawings(rows);
        setStatus('idle');
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const raw = err instanceof Error ? err.message : 'Erreur inconnue';
        setErrorMsg(raw === 'IndexedDB unavailable' ? 'Stockage local indisponible (navigation privée ?).' : raw);
        setStatus('error');
      });
    return () => { cancelled = true; };
  }, [isAuth, sessionLoading, reloadKey]);

  const reload = () => setReloadKey((k) => k + 1);

  // Chaque relecture et chaque mutation optimiste ouvrent une nouvelle génération : une relecture
  // partie avant elles (réponse plus lente) ne doit pas les écraser avec des lignes périmées.
  const refetchSilent = () => {
    const gen = ++fetchGenRef.current;
    fetchDrawings()
      .then((rows) => { if (gen === fetchGenRef.current) setDrawings(rows); })
      .catch(() => {});
  };

  const updateDrawings: Dispatch<SetStateAction<DrawingRow[]>> = (next) => {
    fetchGenRef.current += 1;
    setDrawings(next);
  };

  // Mise à jour optimiste refusée : on prévient et on resynchronise avec la source.
  const onMutationError = () => {
    snackbar.show('Échec de la modification, liste rechargée');
    refetchSilent();
  };

  const handleCollaboratorRemoved = (drawingId: string) => {
    updateDrawings((prev) =>
      prev.map((d) =>
        d.id === drawingId ? { ...d, collaborator_count: Math.max(0, d.collaborator_count - 1) } : d,
      ),
    );
  };

  const handleRename = (id: string, newTitle: string) => {
    updateDrawings((prev) =>
      prev.map((d) => (d.id === id ? { ...d, title: newTitle } : d)),
    );
    renameDrawing(id, newTitle).catch(onMutationError);
  };

  const handleDelete = (id: string) => {
    updateDrawings((prev) => prev.filter((d) => d.id !== id));
    deleteDrawing(id).catch(onMutationError);
  };

  const handleRemoveFromGroup = (id: string) => {
    updateDrawings((prev) =>
      prev.map((d) => (d.id === id ? { ...d, group: null } : d)),
    );
    removeFromGroup(id).catch(onMutationError);
  };

  const handleGroupPair = (sourceId: string, targetId: string, groupName: string) => {
    updateDrawings((prev) =>
      prev.map((d) =>
        d.id === sourceId || d.id === targetId ? { ...d, group: groupName } : d,
      ),
    );
    Promise.all([
      moveToGroup(sourceId, groupName),
      moveToGroup(targetId, groupName),
    ]).catch(onMutationError);
  };

  // Dissoudre passe par un seul appel : les membres du groupe doivent disparaître avec lui,
  // sinon un dessin re-déposé plus tard sous le même nom serait re-partagé silencieusement.
  const handleUngroupAll = (groupName: string) => {
    updateDrawings((prev) => prev.map((d) => d.group === groupName ? { ...d, group: null } : d));
    dissolveGroup(groupName).then(refetchSilent, onMutationError);
  };

  const handleRenameGroup = (oldName: string, newName: string): boolean => {
    if (!newName || newName === oldName) return false;
    if (drawings.some((d) => d.group === newName)) return false;
    updateDrawings((prev) =>
      prev.map((d) => (d.group === oldName ? { ...d, group: newName } : d)),
    );
    renameGroup(oldName, newName).catch(onMutationError);
    return true;
  };

  // Seuls les dessins de l'appelant sont supprimés : ceux partagés par d'autres sous le même
  // nom de groupe ne lui appartiennent pas (la suppression échouerait et laisserait le groupe
  // à moitié détruit).
  const handleDeleteGroup = (groupName: string) => {
    const isMine = (d: DrawingRow) => d.group === groupName && d.owner_id === currentUserId;
    const ids = drawings.filter(isMine).map((d) => d.id);
    updateDrawings((prev) => prev.filter((d) => !isMine(d)));
    Promise.all(ids.map((id) => deleteDrawing(id)))
      .then(() => dissolveGroup(groupName))
      .then(refetchSilent, onMutationError);
  };

  // Le serveur partage automatiquement le dessin aux membres du groupe : on relit pour que le
  // compteur de collaborateurs de la carte reflète ce partage.
  const handleMoveToGroup = (drawingId: string, groupName: string) => {
    updateDrawings((prev) =>
      prev.map((d) => (d.id === drawingId ? { ...d, group: groupName } : d)),
    );
    moveToGroup(drawingId, groupName).then(refetchSilent, onMutationError);
  };

  return {
    drawings,
    setDrawings: updateDrawings,
    status,
    errorMsg,
    reload,
    refetchSilent,
    handleCollaboratorRemoved,
    handleRename,
    handleDelete,
    handleRemoveFromGroup,
    handleGroupPair,
    handleUngroupAll,
    handleRenameGroup,
    handleDeleteGroup,
    handleMoveToGroup,
  };
}
