import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/Button';
import { useSnackbar } from '@/components/Snackbar';
import { DrawingCard } from './DrawingCard/DrawingCard';
import { GroupCard } from './GroupCard/GroupCard';
import { GroupModal } from './GroupModal/GroupModal';
import { NewDrawingModal } from './NewDrawingModal/NewDrawingModal';
import { NewGroupModal } from './NewGroupModal/NewGroupModal';
import { InviteCollaboratorModal } from './InviteCollaboratorModal/InviteCollaboratorModal';
import { createDrawing, fetchDrawings, renameDrawing, deleteDrawing, removeFromGroup, moveToGroup, renameGroup } from '@/lib/drawings';
import { signOut } from '@/lib/auth';
import { groupDrawings } from '@/lib/groupDrawings';
import type { DrawingRow } from '@/types';
import styles from './Gallery.module.scss';

type Status = 'idle' | 'loading' | 'error';

export function Gallery() {
  const navigate = useNavigate();
  const snackbar = useSnackbar();
  const [drawings, setDrawings] = useState<DrawingRow[]>([]);
  const [status, setStatus] = useState<Status>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [showNewModal, setShowNewModal] = useState(false);
  const [activeGroup, setActiveGroup] = useState<string | null>(null);
  const [pendingGroup, setPendingGroup] = useState<{ sourceId: string; targetId: string } | null>(null);
  const [isContentDragOver, setIsContentDragOver] = useState(false);
  const [inviteTarget, setInviteTarget] = useState<DrawingRow | null>(null);

  useEffect(() => {
    setStatus('loading');
    fetchDrawings()
      .then((rows) => { setDrawings(rows); setStatus('idle'); })
      .catch((err: unknown) => {
        setErrorMsg(err instanceof Error ? err.message : 'Erreur inconnue');
        setStatus('error');
      });
  }, []);

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
    setActiveGroup((g) => (g === oldName ? newName : g));
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
  const activeGroupData = useMemo(
    () => (activeGroup ? (groups.find((g) => g.name === activeGroup) ?? null) : null),
    [activeGroup, groups],
  );

  return (
    <main className={styles.gallery}>
      <a className="skip-link" href="#gallery-content">Aller au contenu</a>
      <div className={styles.decoLeft}>
        <div className={styles.version}>v{__APP_VERSION__}</div>
      </div>
      <header className={styles.header}>
        <div className={styles.titleGroup}>
          <h1 className={styles.title}>Pixel Perfect</h1>
          
        </div>
        <div className={styles.headerActions}>
          <Button variant="primary" onClick={() => setShowNewModal(true)}>
            Nouveau dessin
          </Button>
          <Button variant="ghost" onClick={() => void signOut()}>
            Déconnexion
          </Button>
        </div>
      </header>

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
              onOpen={() => setActiveGroup(g.name)}
              onDropDrawing={(drawingId) => handleMoveToGroup(drawingId, g.name)}
              onRename={(newName) => handleRenameGroup(g.name, newName)}
              onUngroup={() => handleUngroupAll(g.name)}
              onDelete={() => handleDeleteGroup(g.name)}
              existingGroupNames={groups.map((x) => x.name)}
            />
          ))}
          {ungrouped.map((d) => (
            <DrawingCard
              key={d.id}
              drawing={d}
              onClick={() => navigate(`/editor/${d.id}`)}
              onRename={(title) => handleRename(d.id, title)}
              onDelete={() => handleDelete(d.id)}
              onInvite={() => setInviteTarget(d)}
              onDropDrawing={(sourceId) => setPendingGroup({ sourceId, targetId: d.id })}
            />
          ))}
        </div>
      )}

      {pendingGroup && (
        <NewGroupModal
          onClose={() => setPendingGroup(null)}
          onConfirm={handleCreateGroup}
        />
      )}

      {activeGroupData && (
        <GroupModal
          name={activeGroupData.name}
          drawings={activeGroupData.drawings}
          onClose={() => setActiveGroup(null)}
          onCardClick={(id) => navigate(`/editor/${id}`)}
          onRename={handleRename}
          onDelete={handleDelete}
          onRemoveFromGroup={handleRemoveFromGroup}
          onInvite={(d) => setInviteTarget(d)}
        />
      )}

      {inviteTarget && (
        <InviteCollaboratorModal
          drawingId={inviteTarget.id}
          drawingTitle={inviteTarget.title}
          onClose={() => setInviteTarget(null)}
          onInvited={(_userId, email) => {
            const id = inviteTarget.id;
            setDrawings((prev) =>
              prev.map((d) =>
                d.id === id ? { ...d, collaborator_count: d.collaborator_count + 1 } : d,
              ),
            );
            snackbar.show(`${email} a été invité`, { icon: 'collaborators' });
          }}
        />
      )}
    </main>
  );
}
