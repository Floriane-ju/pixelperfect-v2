import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/Button';
import { useSnackbar } from '@/components/Snackbar';
import { useSession } from '@/components/SessionProvider';
import { DrawingCard } from './DrawingCard/DrawingCard';
import { GroupCard } from './GroupCard/GroupCard';
import { GroupModal } from './GroupModal/GroupModal';
import { NewDrawingModal } from './NewDrawingModal/NewDrawingModal';
import { NewGroupModal } from './NewGroupModal/NewGroupModal';
import { InviteCollaboratorModal } from './InviteCollaboratorModal/InviteCollaboratorModal';
import { ProfileModal } from './ProfileModal';
import { createDrawing, fetchDrawings, renameDrawing, deleteDrawing, removeFromGroup, moveToGroup, renameGroup } from '@/lib/drawingStore';
import { signOut } from '@/lib/auth';
import { LOCAL_OWNER } from '@/lib/localLibrary';
import { exportLibrary, importLibrary } from '@/lib/libraryTransfer';
import { groupDrawings } from '@/lib/groupDrawings';
import type { DrawingRow } from '@/types';
import { SnakeCanvas } from '@/components/SnakeCanvas';
import { version as appVersion } from '../../../package.json';
import styles from './Gallery.module.scss';

type Status = 'idle' | 'loading' | 'error';

const MAX_IMPORT_BYTES = 20 * 1024 * 1024; // 20 Mo

export function Gallery() {
  const navigate = useNavigate();
  const snackbar = useSnackbar();
  const { session, loading: sessionLoading } = useSession();
  const isAuth = session !== null;
  // Une seule source de vérité pour l'identité : la session du contexte (pas d'appel getUser).
  const currentUserId = session ? session.user.id : LOCAL_OWNER;
  const [drawings, setDrawings] = useState<DrawingRow[]>([]);
  const [status, setStatus] = useState<Status>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const [showNewModal, setShowNewModal] = useState(false);
  const [activeGroups, setActiveGroups] = useState<string[]>([]);
  const [pendingGroup, setPendingGroup] = useState<{ sourceId: string; targetId: string } | null>(null);
  const [isContentDragOver, setIsContentDragOver] = useState(false);
  const [inviteTarget, setInviteTarget] = useState<DrawingRow | null>(null);
  const [showProfile, setShowProfile] = useState(false);
  const [snakeActive, setSnakeActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Recharge la bibliothèque à chaque changement d'auth (login/logout) une fois la session résolue.
  useEffect(() => {
    if (sessionLoading) return;
    setStatus('loading');
    fetchDrawings()
      .then((rows) => { setDrawings(rows); setStatus('idle'); })
      .catch((err: unknown) => {
        const raw = err instanceof Error ? err.message : 'Erreur inconnue';
        setErrorMsg(raw === 'IndexedDB unavailable' ? 'Stockage local indisponible (navigation privée ?).' : raw);
        setStatus('error');
      });
  }, [isAuth, sessionLoading]);

  const handleExport = () => {
    exportLibrary()
      .then(() => snackbar.show('Bibliothèque exportée', { icon: 'export' }))
      .catch(() => snackbar.show('Échec de l’export'));
  };

  const handleImportFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > MAX_IMPORT_BYTES) {
      snackbar.show('Fichier trop volumineux (max 20 Mo).');
      return;
    }
    try {
      const count = await importLibrary(await file.text());
      const rows = await fetchDrawings();
      setDrawings(rows);
      snackbar.show(`${count} dessin${count > 1 ? 's' : ''} importé${count > 1 ? 's' : ''}`);
    } catch (err) {
      snackbar.show(err instanceof Error ? err.message : 'Échec de l’import');
    }
  };

  const handleCollaboratorRemoved = (drawingId: string) => {
    setDrawings((prev) =>
      prev.map((d) =>
        d.id === drawingId ? { ...d, collaborator_count: Math.max(0, d.collaborator_count - 1) } : d,
      ),
    );
  };

  const refetchSilent = () => {
    fetchDrawings().then(setDrawings).catch(() => {});
  };

  const handleRename = (id: string, newTitle: string) => {
    setDrawings((prev) =>
      prev.map((d) => (d.id === id ? { ...d, title: newTitle } : d)),
    );
    renameDrawing(id, newTitle).catch(refetchSilent);
  };

  const handleDelete = (id: string) => {
    setDrawings((prev) => prev.filter((d) => d.id !== id));
    deleteDrawing(id).catch(refetchSilent);
  };

  const handleRemoveFromGroup = (id: string) => {
    setDrawings((prev) =>
      prev.map((d) => (d.id === id ? { ...d, group: null } : d)),
    );
    removeFromGroup(id).catch(refetchSilent);
  };

  const handleCreateGroup = (groupName: string) => {
    if (!pendingGroup) return;
    const { sourceId, targetId } = pendingGroup;
    setPendingGroup(null);
    setDrawings((prev) =>
      prev.map((d) =>
        d.id === sourceId || d.id === targetId ? { ...d, group: groupName } : d,
      ),
    );
    Promise.all([
      moveToGroup(sourceId, groupName),
      moveToGroup(targetId, groupName),
    ]).catch(refetchSilent);
  };

  const handleUngroupAll = (groupName: string) => {
    const ids = drawings.filter((d) => d.group === groupName).map((d) => d.id);
    setDrawings((prev) => prev.map((d) => d.group === groupName ? { ...d, group: null } : d));
    Promise.all(ids.map((id) => removeFromGroup(id))).catch(refetchSilent);
  };

  const handleRenameGroup = (oldName: string, newName: string) => {
    if (!newName || newName === oldName) return;
    if (drawings.some((d) => d.group === newName)) return;
    setDrawings((prev) =>
      prev.map((d) => (d.group === oldName ? { ...d, group: newName } : d)),
    );
    setActiveGroups((arr) => arr.map((n) => (n === oldName ? newName : n)));
    renameGroup(oldName, newName).catch(refetchSilent);
  };

  const handleDeleteGroup = (groupName: string) => {
    const ids = drawings.filter((d) => d.group === groupName).map((d) => d.id);
    setDrawings((prev) => prev.filter((d) => d.group !== groupName));
    Promise.all(ids.map((id) => deleteDrawing(id))).catch(refetchSilent);
  };

  const handleMoveToGroup = (drawingId: string, groupName: string) => {
    setDrawings((prev) =>
      prev.map((d) => (d.id === drawingId ? { ...d, group: groupName } : d)),
    );
    moveToGroup(drawingId, groupName).catch(refetchSilent);
  };

  const handleCreate = async (name: string, width: number, height: number) => {
    const newDrawing = await createDrawing(name, width, height);
    navigate(`/editor/${newDrawing.id}`);
  };

  const { groups, ungrouped } = useMemo(() => groupDrawings(drawings), [drawings]);
  const hasContent = drawings.length > 0;
  const openGroups = useMemo(
    () => activeGroups
      .map((name) => groups.find((g) => g.name === name))
      .filter((g): g is { name: string; drawings: DrawingRow[] } => g !== undefined),
    [activeGroups, groups],
  );

  return (
    <main className={styles.gallery}>
      <SnakeCanvas onModeChange={setSnakeActive} />
      <div className={styles.decoLeft}>
        <div className={styles.version}>v{appVersion}</div>
      </div>
      <div className={`${styles.galleryBody}${snakeActive ? ` ${styles.galleryBodyDimmed}` : ''}`}>
      <a className="skip-link" href="#gallery-content">Aller au contenu</a>
      <header className={styles.header}>
        <div className={styles.titleGroup}>
          <h1 className={styles.title}>Pixel Perfect</h1>
          
        </div>
        <div className={styles.headerActions}>
          <Button variant="primary" onClick={() => setShowNewModal(true)}>
            Nouveau dessin
          </Button>
          {isAuth ? (
            <>
              <Button variant="ghost" onClick={() => setShowProfile(true)}>
                Profil
              </Button>
              <Button variant="ghost" onClick={() => void signOut()}>
                Déconnexion
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" onClick={handleExport}>
                Exporter
              </Button>
              <Button variant="ghost" onClick={() => fileInputRef.current?.click()}>
                Importer
              </Button>
              <Button variant="primary" onClick={() => navigate('/login')}>
                Se connecter
              </Button>
            </>
          )}
        </div>
      </header>

      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        className={styles.hiddenInput}
        onChange={(e) => void handleImportFile(e)}
        aria-hidden="true"
        tabIndex={-1}
      />

      {showNewModal && (
        <NewDrawingModal
          onClose={() => setShowNewModal(false)}
          onConfirm={handleCreate}
        />
      )}

      {status === 'loading' && (
        <div className={styles.state} role="status" aria-live="polite">Chargement…</div>
      )}
      {status === 'error' && (
        <div className={styles.stateError} role="alert">{errorMsg}</div>
      )}
      {status === 'idle' && !hasContent && (
        <div className={styles.state}>Aucun dessin pour le moment.</div>
      )}

      {hasContent && (
        <div
          id="gallery-content"
          className={`${styles.content}${isContentDragOver ? ` ${styles.contentDropTarget}` : ''}`}
          onDragOver={(e) => { e.preventDefault(); setIsContentDragOver(true); }}
          onDragLeave={() => setIsContentDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsContentDragOver(false);
            const drawingId = e.dataTransfer.getData('text/plain');
            const drawing = drawings.find((d) => d.id === drawingId);
            if (drawing?.group) handleRemoveFromGroup(drawingId);
          }}
        >
          {groups.map((g) => (
            <GroupCard
              key={g.name}
              name={g.name}
              drawings={g.drawings}
              onOpen={() => setActiveGroups((arr) => (arr.includes(g.name) ? arr : [...arr, g.name]))}
              onDropDrawing={(drawingId) => handleMoveToGroup(drawingId, g.name)}
              onRename={(newName) => handleRenameGroup(g.name, newName)}
              onUngroup={() => handleUngroupAll(g.name)}
              onDelete={() => handleDeleteGroup(g.name)}
              existingGroupNames={groups.map((x) => x.name)}
            />
          ))}
          {ungrouped.map((d) => {
            const isOwner = currentUserId !== null && d.owner_id === currentUserId;
            return (
              <DrawingCard
                key={d.id}
                drawing={d}
                isOwner={isOwner}
                onClick={() => navigate(`/editor/${d.id}`)}
                onRename={(title) => handleRename(d.id, title)}
                onDelete={isOwner ? () => handleDelete(d.id) : undefined}
                onInvite={isAuth && isOwner ? () => setInviteTarget(d) : undefined}
                onCollaboratorRemoved={() => handleCollaboratorRemoved(d.id)}
                onDropDrawing={(sourceId) => setPendingGroup({ sourceId, targetId: d.id })}
              />
            );
          })}
        </div>
      )}

      {pendingGroup && (
        <NewGroupModal
          onClose={() => setPendingGroup(null)}
          onConfirm={handleCreateGroup}
        />
      )}

      {openGroups.map((g) => (
        <GroupModal
          key={g.name}
          name={g.name}
          drawings={g.drawings}
          currentUserId={currentUserId}
          onClose={() => setActiveGroups((arr) => arr.filter((n) => n !== g.name))}
          onCardClick={(id) => navigate(`/editor/${id}`)}
          onRename={handleRename}
          onDelete={handleDelete}
          onRemoveFromGroup={handleRemoveFromGroup}
          onInvite={isAuth ? (d) => setInviteTarget(d) : undefined}
          onCollaboratorRemoved={handleCollaboratorRemoved}
        />
      ))}

      {inviteTarget && (
        <InviteCollaboratorModal
          drawingId={inviteTarget.id}
          drawingTitle={inviteTarget.title}
          onClose={() => setInviteTarget(null)}
          onInvited={(_userId, handle) => {
            const id = inviteTarget.id;
            setDrawings((prev) =>
              prev.map((d) =>
                d.id === id ? { ...d, collaborator_count: d.collaborator_count + 1 } : d,
              ),
            );
            snackbar.show(`${handle} a été invité`, { icon: 'collaborators' });
          }}
        />
      )}

      {showProfile && (
        <ProfileModal
          onClose={() => setShowProfile(false)}
          onUpdated={(p) => snackbar.show(`Pseudo mis à jour : ${p.username}`)}
        />
      )}
      </div>
    </main>
  );
}
