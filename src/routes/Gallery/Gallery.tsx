import { useMemo, useRef, useState } from 'react';
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
import { createDrawing, fetchDrawings, moveToGroup } from '@/lib/drawingStore';
import { signOut } from '@/lib/auth';
import { LOCAL_OWNER } from '@/lib/localLibrary';
import { exportLibrary, importLibrary } from '@/lib/libraryTransfer';
import { groupDrawings } from '@/lib/groupDrawings';
import type { DrawingGroup } from '@/lib/groupDrawings';
import { cx } from '@/lib/cx';
import { SnakeCanvas } from '@/components/SnakeCanvas';
import { GalleryDock } from './GalleryDock';
import { GalleryEmpty, GalleryError, GalleryLoading } from './GalleryStates/GalleryStates';
import { useGalleryLibrary } from './useGalleryLibrary';
import styles from './Gallery.module.scss';

const DECO_STRIP_KEYS = [0, 1, 2, 3, 4, 5]; // bande du pied, couleurs `$deco-strip`
const MAX_IMPORT_BYTES = 20 * 1024 * 1024; // 20 Mo

/**
 * Défilement (px) sur lequel le header passe progressivement de sa taille pleine à sa taille
 * réduite. La progression suit `scrollTop` sans seuil : si la réduction supprime le débordement,
 * `scrollTop` est borné et le header se stabilise à mi-course au lieu d'osciller.
 */
const SCROLL_COMPACT_RANGE = 200;

export function Gallery() {
  const navigate = useNavigate();
  const snackbar = useSnackbar();
  const { session, loading: sessionLoading } = useSession();
  const isAuth = session !== null;
  // Une seule source de vérité pour l'identité : la session du contexte (pas d'appel getUser).
  const currentUserId = session ? session.user.id : LOCAL_OWNER;
  const {
    drawings,
    setDrawings,
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
  } = useGalleryLibrary({ isAuth, sessionLoading, currentUserId });
  const [showNewModal, setShowNewModal] = useState(false);
  /** Groupe dans lequel créer le prochain dessin (null = hors groupe). */
  const [newDrawingGroup, setNewDrawingGroup] = useState<string | null>(null);
  const [activeGroups, setActiveGroups] = useState<string[]>([]);
  const [pendingGroup, setPendingGroup] = useState<{ sourceId: string; targetId: string } | null>(
    null
  );
  const [isContentDragOver, setIsContentDragOver] = useState(false);
  const [inviteTarget, setInviteTarget] = useState<InviteTarget | null>(null);
  const [showProfile, setShowProfile] = useState(false);
  const [groupToDelete, setGroupToDelete] = useState<string | null>(null);
  const [snakeActive, setSnakeActive] = useState(false);
  /** Fin de course atteinte : le bloc méta sort du flux (sans effet sur la hauteur du header). */
  const [isCompact, setIsCompact] = useState(false);
  const headerRef = useRef<HTMLElement>(null);
  const titleFirstRef = useRef<HTMLSpanElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleCreateGroup = (groupName: string) => {
    if (!pendingGroup) return;
    setPendingGroup(null);
    handleGroupPair(pendingGroup.sourceId, pendingGroup.targetId, groupName);
  };

  const renameGroupAndOpenModals = (oldName: string, newName: string) => {
    if (handleRenameGroup(oldName, newName)) {
      setActiveGroups((arr) => arr.map((n) => (n === oldName ? newName : n)));
    }
  };

  const handleCreate = async (name: string, width: number, height: number) => {
    const newDrawing = await createDrawing(name, width, height);
    // Le dessin existe déjà : un échec ici ne doit pas inviter à recréer (doublon).
    if (newDrawingGroup) {
      await moveToGroup(newDrawing.id, newDrawingGroup).catch(() =>
        snackbar.show('Dessin créé hors du groupe')
      );
    }
    navigate(`/editor/${newDrawing.id}`);
  };

  const handleContentScroll = (e: UIEvent<HTMLDivElement>) => {
    const progress = Math.min(Math.max(e.currentTarget.scrollTop / SCROLL_COMPACT_RANGE, 0), 1);
    const header = headerRef.current;
    const first = titleFirstRef.current;
    if (!header || !first) return;
    // Largeur de « Pixel » en em (indépendante de la taille du titre) : « Perfect » glisse
    // d'autant pour rejoindre la première ligne, sans bascule de mise en page.
    const fontSize = parseFloat(getComputedStyle(first).fontSize);
    header.style.setProperty('--title-first-width', String(first.offsetWidth / fontSize));
    // Variables CSS posées directement : pas de rendu React à chaque frame de défilement.
    header.style.setProperty('--compact', String(progress));
    setIsCompact(progress === 1);
  };

  const { groups, ungrouped } = useMemo(() => groupDrawings(drawings), [drawings]);
  // Un groupe appartient à qui y possède des dessins : le partage porte sur (utilisateur, nom),
  // donc un même nom chez deux personnes reste deux groupes distincts.
  const ownsGroup = (g: DrawingGroup) => g.drawings.some((d) => d.owner_id === currentUserId);
  const hasContent = drawings.length > 0;
  const openGroups = useMemo(
    () =>
      activeGroups
        .map((name) => groups.find((g) => g.name === name))
        .filter((g): g is DrawingGroup => g !== undefined),
    [activeGroups, groups]
  );

  const openNewDrawing = () => {
    setNewDrawingGroup(null);
    setShowNewModal(true);
  };
  const countLabel = `${String(drawings.length).padStart(2, '0')} dessin${drawings.length > 1 ? 's' : ''}`;

  return (
    <div className={styles.page}>
      <SnakeCanvas onModeChange={setSnakeActive} />
      <div className={cx(styles.galleryBody, snakeActive && styles.galleryBodyDimmed)}>
        <a className="skip-link" href="#gallery-content">
          Aller au contenu
        </a>
        <GalleryDock
          isAuth={isAuth}
          onImport={() => fileInputRef.current?.click()}
          onExport={handleExport}
          onLogin={() => navigate('/login')}
          onProfile={() => setShowProfile(true)}
          onSignOut={() => void signOut()}
        />

        <main className={styles.gallery}>
          <header ref={headerRef} className={styles.header}>
            <h1 className={styles.title}>
              <span ref={titleFirstRef}>Pixel</span>
              <span className={styles.titleLast}>Perfect</span>
            </h1>
            <div className={styles.headerAside}>
              <dl className={cx(styles.meta, isCompact && styles.metaHidden)}>
                <dt>Bibliothèque</dt>
                <dd>{countLabel}</dd>
                <dt>Stockage</dt>
                <dd>{isAuth ? 'Compte' : 'Cet appareil'}</dd>
                <dt>Export</dt>
                <dd>PNG · SVG · JSON</dd>
                <dt>Version</dt>
                <dd>{__APP_VERSION__}</dd>
              </dl>
              <Button
                variant="primary"
                iconLeft="add"
                aria-haspopup="dialog"
                onClick={openNewDrawing}
              >
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
            <NewDrawingModal onClose={() => setShowNewModal(false)} onConfirm={handleCreate} />
          )}

          <div id="gallery-content" className={styles.scroller} onScroll={handleContentScroll}>
            {status === 'loading' && <GalleryLoading />}
            {status === 'error' && <GalleryError message={errorMsg} onRetry={reload} />}
            {status === 'idle' && !hasContent && (
              <GalleryEmpty
                onCreate={openNewDrawing}
                onLogin={isAuth ? undefined : () => navigate('/login')}
              />
            )}

            {hasContent && (
              <section
                aria-label="Mes dessins"
                className={cx(styles.content, isContentDragOver && styles.contentDropTarget)}
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsContentDragOver(true);
                }}
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
                    onOpen={() =>
                      setActiveGroups((arr) => (arr.includes(g.name) ? arr : [...arr, g.name]))
                    }
                    onDropDrawing={(drawingId) => handleMoveToGroup(drawingId, g.name)}
                    onShare={
                      isAuth && ownsGroup(g)
                        ? () => setInviteTarget({ kind: 'group', name: g.name })
                        : undefined
                    }
                    onRename={(newName) => renameGroupAndOpenModals(g.name, newName)}
                    onUngroup={() => handleUngroupAll(g.name)}
                    onDelete={ownsGroup(g) ? () => setGroupToDelete(g.name) : undefined}
                    existingGroupNames={groups.map((x) => x.name)}
                  />
                ))}
                {ungrouped.map((d, i) => {
                  const isOwner = currentUserId !== null && d.owner_id === currentUserId;
                  return (
                    <DrawingCard
                      key={d.id}
                      drawing={d}
                      index={i}
                      isOwner={isOwner}
                      onClick={() => navigate(`/editor/${d.id}`)}
                      onRename={(title) => handleRename(d.id, title)}
                      onDelete={isOwner ? () => handleDelete(d.id) : undefined}
                      onInvite={
                        isAuth && isOwner
                          ? () => setInviteTarget({ kind: 'drawing', id: d.id, title: d.title })
                          : undefined
                      }
                      onCollaboratorRemoved={() => handleCollaboratorRemoved(d.id)}
                      onDropDrawing={(sourceId) => setPendingGroup({ sourceId, targetId: d.id })}
                    />
                  );
                })}
              </section>
            )}

            <footer className={styles.footer}>
              <span>Planche 1 / 1 — PixelPerfect</span>
              <span className={styles.strip} aria-hidden="true">
                {DECO_STRIP_KEYS.map((k) => (
                  <span key={k} />
                ))}
              </span>
            </footer>
          </div>
        </main>
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
          <NewGroupModal onClose={() => setPendingGroup(null)} onConfirm={handleCreateGroup} />
        )}

        {openGroups.map((g) => (
          <GroupModal
            key={g.name}
            name={g.name}
            drawings={g.drawings}
            currentUserId={currentUserId}
            onClose={() => setActiveGroups((arr) => arr.filter((n) => n !== g.name))}
            onCardClick={(id) => navigate(`/editor/${id}`)}
            onShare={
              isAuth && ownsGroup(g)
                ? () => setInviteTarget({ kind: 'group', name: g.name })
                : undefined
            }
            onSharingChanged={refetchSilent}
            onNewDrawing={() => {
              setNewDrawingGroup(g.name);
              setShowNewModal(true);
            }}
            onRename={handleRename}
            onDelete={handleDelete}
            onRemoveFromGroup={handleRemoveFromGroup}
            onInvite={
              isAuth
                ? (d) => setInviteTarget({ kind: 'drawing', id: d.id, title: d.title })
                : undefined
            }
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
                  d.id === id ? { ...d, collaborator_count: d.collaborator_count + 1 } : d
                )
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
    </div>
  );
}
