import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, UIEvent } from 'react';
import { useNavigate } from 'react-router';
import { Button } from '@/components/Button';
import { ConfirmModal } from '@/components/ConfirmModal';
import { useSnackbar } from '@/components/Snackbar';
import { useSession } from '@/components/SessionProvider';
import { DrawingCard } from './DrawingCard/DrawingCard';
import { GroupCard } from './GroupCard/GroupCard';
import { GroupModal } from './GroupModal/GroupModal';
import { NewDrawingModal } from './NewDrawingModal/NewDrawingModal';
import { NewGroupModal } from './NewGroupModal/NewGroupModal';
import { InviteCollaboratorModal } from './InviteCollaboratorModal/InviteCollaboratorModal';
import type { InviteTarget } from './InviteCollaboratorModal/InviteCollaboratorModal';
import { ProfileModal } from './ProfileModal/ProfileModal';
import { createDrawing, fetchDrawings, renameDrawing, deleteDrawing, removeFromGroup, moveToGroup, renameGroup, dissolveGroup } from '@/lib/drawingStore';
import { signOut } from '@/lib/auth';
import { LOCAL_OWNER } from '@/lib/localLibrary';
import { exportLibrary, importLibrary } from '@/lib/libraryTransfer';
import { groupDrawings } from '@/lib/groupDrawings';
import type { DrawingGroup } from '@/lib/groupDrawings';
import { cx } from '@/lib/cx';
import type { DrawingRow } from '@/types';
import { SnakeCanvas } from '@/components/SnakeCanvas';
import { version as appVersion } from '../../../package.json';
import styles from './Gallery.module.scss';

type Status = 'idle' | 'loading' | 'error';

const MAX_IMPORT_BYTES = 20 * 1024 * 1024; // 20 Mo

/** Défilement (px) à partir duquel le header passe en mode réduit. */
const SCROLL_COMPACT_THRESHOLD = 24;

/**
 * Marge de défilement restante (px) exigée pour ré-agrandir le header : légèrement au-dessus
 * de la hauteur libérée par la réduction (~166 px : titre 2 lignes → 1 ligne + paddings).
 * En dessous, ré-agrandir supprimerait le débordement, `scrollTop` retomberait à 0 et le
 * header oscillerait entre les deux tailles.
 */
const SCROLL_EXPAND_MIN_OVERFLOW = 200;

/** Distance (px) d'un glissement vers le bas rétablissant le header quand la liste est en haut. */
const TOUCH_EXPAND_DISTANCE = 8;

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
  /** Groupe dans lequel créer le prochain dessin (null = hors groupe). */
  const [newDrawingGroup, setNewDrawingGroup] = useState<string | null>(null);
  const [activeGroups, setActiveGroups] = useState<string[]>([]);
  const [pendingGroup, setPendingGroup] = useState<{ sourceId: string; targetId: string } | null>(null);
  const [isContentDragOver, setIsContentDragOver] = useState(false);
  const [inviteTarget, setInviteTarget] = useState<InviteTarget | null>(null);
  const [showProfile, setShowProfile] = useState(false);
  const [groupToDelete, setGroupToDelete] = useState<string | null>(null);
  const [snakeActive, setSnakeActive] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const touchStartY = useRef(0);
  /** Génération de l'identité courante : les réponses d'une session précédente sont ignorées. */
  const fetchGenRef = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Recharge la bibliothèque à chaque changement d'auth (login/logout) une fois la session résolue.
  useEffect(() => {
    if (sessionLoading) return;
    // Une réponse de l'identité précédente (fetch lent) ne doit pas écraser la nouvelle.
    let cancelled = false;
    fetchGenRef.current += 1;
    setDrawings([]);
    setStatus('loading');
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
    const gen = fetchGenRef.current;
    fetchDrawings()
      .then((rows) => { if (gen === fetchGenRef.current) setDrawings(rows); })
      .catch(() => {});
  };

  // Mise à jour optimiste refusée : on prévient et on resynchronise avec la source.
  const onMutationError = () => {
    snackbar.show('Échec de la modification, liste rechargée');
    refetchSilent();
  };

  const handleRename = (id: string, newTitle: string) => {
    setDrawings((prev) =>
      prev.map((d) => (d.id === id ? { ...d, title: newTitle } : d)),
    );
    renameDrawing(id, newTitle).catch(onMutationError);
  };

  const handleDelete = (id: string) => {
    setDrawings((prev) => prev.filter((d) => d.id !== id));
    deleteDrawing(id).catch(onMutationError);
  };

  const handleRemoveFromGroup = (id: string) => {
    setDrawings((prev) =>
      prev.map((d) => (d.id === id ? { ...d, group: null } : d)),
    );
    removeFromGroup(id).catch(onMutationError);
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
    ]).catch(onMutationError);
  };

  // Dissoudre passe par un seul appel : les membres du groupe doivent disparaître avec lui,
  // sinon un dessin re-déposé plus tard sous le même nom serait re-partagé silencieusement.
  const handleUngroupAll = (groupName: string) => {
    setDrawings((prev) => prev.map((d) => d.group === groupName ? { ...d, group: null } : d));
    dissolveGroup(groupName).then(refetchSilent, onMutationError);
  };

  const handleRenameGroup = (oldName: string, newName: string) => {
    if (!newName || newName === oldName) return;
    if (drawings.some((d) => d.group === newName)) return;
    setDrawings((prev) =>
      prev.map((d) => (d.group === oldName ? { ...d, group: newName } : d)),
    );
    setActiveGroups((arr) => arr.map((n) => (n === oldName ? newName : n)));
    renameGroup(oldName, newName).catch(onMutationError);
  };

  // Seuls les dessins de l'appelant sont supprimés : ceux partagés par d'autres sous le même
  // nom de groupe ne lui appartiennent pas (la suppression échouerait et laisserait le groupe
  // à moitié détruit).
  const handleDeleteGroup = (groupName: string) => {
    const isMine = (d: DrawingRow) => d.group === groupName && d.owner_id === currentUserId;
    const ids = drawings.filter(isMine).map((d) => d.id);
    setDrawings((prev) => prev.filter((d) => !isMine(d)));
    Promise.all(ids.map((id) => deleteDrawing(id)))
      .then(() => dissolveGroup(groupName))
      .then(refetchSilent, onMutationError);
  };

  // Le serveur partage automatiquement le dessin aux membres du groupe : on relit pour que le
  // compteur de collaborateurs de la carte reflète ce partage.
  const handleMoveToGroup = (drawingId: string, groupName: string) => {
    setDrawings((prev) =>
      prev.map((d) => (d.id === drawingId ? { ...d, group: groupName } : d)),
    );
    moveToGroup(drawingId, groupName).then(refetchSilent, onMutationError);
  };

  const handleCreate = async (name: string, width: number, height: number) => {
    const newDrawing = await createDrawing(name, width, height);
    // Le dessin existe déjà : un échec ici ne doit pas inviter à recréer (doublon).
    if (newDrawingGroup) {
      await moveToGroup(newDrawing.id, newDrawingGroup).catch(() =>
        snackbar.show('Dessin créé hors du groupe'),
      );
    }
    navigate(`/editor/${newDrawing.id}`);
  };

  const handleContentScroll = (e: UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    // Hystérésis : une fois réduit, le header ne revient à sa taille pleine qu'en haut de liste
    // et si la grille garde assez de débordement pour rester scrollable une fois ré-agrandie —
    // sinon `scrollTop` retomberait à 0 et le header oscillerait. En deçà, seul un geste
    // explicite vers le haut le rétablit (cf. expandIfAtTop).
    const overflow = el.scrollHeight - el.clientHeight;
    setIsScrolled((prev) =>
      prev
        ? !(el.scrollTop === 0 && overflow > SCROLL_EXPAND_MIN_OVERFLOW)
        : el.scrollTop > SCROLL_COMPACT_THRESHOLD,
    );
  };

  /**
   * Rétablit le header sur un geste vers le haut alors que la liste est déjà en butée : à
   * `scrollTop` 0 le navigateur n'émet plus d'événement `scroll`, molette et toucher sont donc
   * les seuls signaux disponibles.
   */
  const expandIfAtTop = (el: HTMLDivElement) => {
    if (el.scrollTop === 0) setIsScrolled(false);
  };

  const { groups, ungrouped } = useMemo(() => groupDrawings(drawings), [drawings]);
  // Un groupe appartient à qui y possède des dessins : le partage porte sur (utilisateur, nom),
  // donc un même nom chez deux personnes reste deux groupes distincts.
  const ownsGroup = (g: DrawingGroup) => g.drawings.some((d) => d.owner_id === currentUserId);
  const hasContent = drawings.length > 0;
  const openGroups = useMemo(
    () => activeGroups
      .map((name) => groups.find((g) => g.name === name))
      .filter((g): g is DrawingGroup => g !== undefined),
    [activeGroups, groups],
  );

  return (
    <main className={styles.gallery}>
      <SnakeCanvas onModeChange={setSnakeActive} />
      <div className={styles.version}>v{appVersion}</div>
      <div className={cx(styles.galleryBody, snakeActive && styles.galleryBodyDimmed)}>
      <a className="skip-link" href="#gallery-content">Aller au contenu</a>
      <header className={cx(styles.header, isScrolled && styles.headerCompact)}>
        <div className={styles.titleGroup}>
          <h1 className={cx(styles.title, isScrolled && styles.titleCompact)}>Pixel<br />Perfect</h1>
        </div>
        <div className={styles.headerActions}>
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
              <Button variant="ghost" onClick={() => navigate('/login')}>
                Se connecter
              </Button>
            </>
          )}
          <Button variant="primary" onClick={() => { setNewDrawingGroup(null); setShowNewModal(true); }}>
            Nouveau dessin
          </Button>
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
          className={cx(styles.content, isContentDragOver && styles.contentDropTarget)}
          onScroll={handleContentScroll}
          onWheel={(e) => { if (e.deltaY < 0) expandIfAtTop(e.currentTarget); }}
          onTouchStart={(e) => { touchStartY.current = e.touches[0]?.clientY ?? 0; }}
          onTouchMove={(e) => {
            const y = e.touches[0]?.clientY;
            if (y !== undefined && y - touchStartY.current > TOUCH_EXPAND_DISTANCE) {
              expandIfAtTop(e.currentTarget);
            }
          }}
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
              onShare={isAuth && ownsGroup(g) ? () => setInviteTarget({ kind: 'group', name: g.name }) : undefined}
              onRename={(newName) => handleRenameGroup(g.name, newName)}
              onUngroup={() => handleUngroupAll(g.name)}
              onDelete={ownsGroup(g) ? () => setGroupToDelete(g.name) : undefined}
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
                onInvite={isAuth && isOwner ? () => setInviteTarget({ kind: 'drawing', id: d.id, title: d.title }) : undefined}
                onCollaboratorRemoved={() => handleCollaboratorRemoved(d.id)}
                onDropDrawing={(sourceId) => setPendingGroup({ sourceId, targetId: d.id })}
              />
            );
          })}
        </div>
      )}

      {groupToDelete !== null && (
        <ConfirmModal
          message={`Supprimer définitivement vos dessins du groupe « ${groupToDelete} » ?`}
          confirmLabel="Supprimer"
          onCancel={() => setGroupToDelete(null)}
          onConfirm={() => {
            handleDeleteGroup(groupToDelete);
            setGroupToDelete(null);
          }}
        />
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
          onShare={isAuth && ownsGroup(g) ? () => setInviteTarget({ kind: 'group', name: g.name }) : undefined}
          onSharingChanged={refetchSilent}
          onNewDrawing={() => { setNewDrawingGroup(g.name); setShowNewModal(true); }}
          onRename={handleRename}
          onDelete={handleDelete}
          onRemoveFromGroup={handleRemoveFromGroup}
          onInvite={isAuth ? (d) => setInviteTarget({ kind: 'drawing', id: d.id, title: d.title }) : undefined}
          onCollaboratorRemoved={handleCollaboratorRemoved}
        />
      ))}

      {inviteTarget && (
        <InviteCollaboratorModal
          target={inviteTarget}
          onClose={() => setInviteTarget(null)}
          onInvited={(_userId, handle) => {
            if (inviteTarget.kind === 'group') {
              // Le backfill serveur partage tous les dessins du groupe d'un coup : on relit.
              refetchSilent();
              snackbar.show(`Groupe partagé avec ${handle}`, { icon: 'collaborators' });
              return;
            }
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
