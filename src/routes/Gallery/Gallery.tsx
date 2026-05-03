import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/Button';
import { DrawingCard } from '@/components/DrawingCard';
import { GroupCard } from '@/components/GroupCard';
import { GroupModal } from '@/components/GroupModal';
import { NewDrawingModal } from '@/components/NewDrawingModal';
import { NewGroupModal } from '@/components/NewGroupModal';
import { createDrawing, fetchDrawings, renameDrawing, deleteDrawing, removeFromGroup, moveToGroup } from '@/lib/drawings';
import { groupDrawings } from '@/lib/groupDrawings';
import type { DrawingRow } from '@/types';
import styles from './Gallery.module.scss';

type Status = 'idle' | 'loading' | 'error';

export function Gallery() {
  const navigate = useNavigate();
  const [drawings, setDrawings] = useState<DrawingRow[]>([]);
  const [status, setStatus] = useState<Status>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [showNewModal, setShowNewModal] = useState(false);
  const [activeGroup, setActiveGroup] = useState<string | null>(null);
  const [pendingGroup, setPendingGroup] = useState<{ sourceId: string; targetId: string } | null>(null);

  useEffect(() => {
    setStatus('loading');
    fetchDrawings()
      .then((rows) => { setDrawings(rows); setStatus('idle'); })
      .catch((err: unknown) => {
        setErrorMsg(err instanceof Error ? err.message : 'Erreur inconnue');
        setStatus('error');
      });
  }, []);

  const handleRename = (id: string, newTitle: string) => {
    setDrawings((prev) =>
      prev.map((d) => (d.id === id ? { ...d, title: newTitle } : d)),
    );
    renameDrawing(id, newTitle).catch((err: unknown) => {
      console.error('rename failed', err);
      fetchDrawings().then(setDrawings).catch(() => null);
    });
  };

  const handleDelete = (id: string) => {
    setDrawings((prev) => prev.filter((d) => d.id !== id));
    deleteDrawing(id).catch((err: unknown) => {
      console.error('delete failed', err);
      fetchDrawings().then(setDrawings).catch(() => null);
    });
  };

  const handleRemoveFromGroup = (id: string) => {
    setDrawings((prev) =>
      prev.map((d) => (d.id === id ? { ...d, group: null } : d)),
    );
    removeFromGroup(id).catch((err: unknown) => {
      console.error('removeFromGroup failed', err);
      fetchDrawings().then(setDrawings).catch(() => null);
    });
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
    ]).catch((err: unknown) => {
      console.error('createGroup failed', err);
      fetchDrawings().then(setDrawings).catch(() => null);
    });
  };

  const handleMoveToGroup = (drawingId: string, groupName: string) => {
    setDrawings((prev) =>
      prev.map((d) => (d.id === drawingId ? { ...d, group: groupName } : d)),
    );
    moveToGroup(drawingId, groupName).catch((err: unknown) => {
      console.error('moveToGroup failed', err);
      fetchDrawings().then(setDrawings).catch(() => null);
    });
  };

  const handleCreate = async (name: string, width: number, height: number) => {
    const newDrawing = await createDrawing(name, width, height);
    navigate(`/editor/${newDrawing.id}`);
  };

  const { groups, ungrouped } = groupDrawings(drawings);
  const hasContent = drawings.length > 0;
  const activeGroupData = activeGroup
    ? (groups.find((g) => g.name === activeGroup) ?? null)
    : null;

  return (
    <section className={styles.gallery}>
      <div className={styles.decoLeft}>
        <div className={styles.version}>v{__APP_VERSION__}</div>
      </div>
      <header className={styles.header}>
        <div className={styles.titleGroup}>
          <h1 className={styles.title}>Pixel Perfect</h1>
          
        </div>
        <Button variant="primary" onClick={() => setShowNewModal(true)}>
          Nouveau dessin
        </Button>
      </header>

      {showNewModal && (
        <NewDrawingModal
          onClose={() => setShowNewModal(false)}
          onConfirm={handleCreate}
        />
      )}

      {status === 'loading' && (
        <div className={styles.state}>Chargement…</div>
      )}
      {status === 'error' && (
        <div className={styles.stateError}>{errorMsg}</div>
      )}
      {status === 'idle' && !hasContent && (
        <div className={styles.state}>Aucun dessin pour le moment.</div>
      )}

      {hasContent && (
        <div className={styles.content}>
          {groups.map((g) => (
            <GroupCard
              key={g.name}
              name={g.name}
              drawings={g.drawings}
              onOpen={() => setActiveGroup(g.name)}
              onDropDrawing={(drawingId) => handleMoveToGroup(drawingId, g.name)}
            />
          ))}
          {ungrouped.map((d) => (
            <DrawingCard
              key={d.id}
              drawing={d}
              onClick={() => navigate(`/editor/${d.id}`)}
              onRename={(title) => handleRename(d.id, title)}
              onDelete={() => handleDelete(d.id)}
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
        />
      )}
    </section>
  );
}
