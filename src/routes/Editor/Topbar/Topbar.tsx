import { useRef, useState } from 'react';
import { Link } from 'react-router';
import { Button } from '@/components/Button';
import { Menu } from '@/components/Menu';
import { useSnackbar } from '@/components/Snackbar';
import { ShareLinkDialog } from '@/components/ShareLinkDialog';
import { InviteCollaboratorModal } from '@/routes/Gallery/InviteCollaboratorModal/InviteCollaboratorModal';
import { LayerPanel } from '@/routes/Editor/LayerPanel/LayerPanel';
import { useOutsideDismiss } from '@/hooks/useOutsideDismiss';
import { useInlineRename } from '@/hooks/useInlineRename';
import { useEditorContext } from '../useEditorContext';
import { buildLayersSvg } from '../exportSvg';
import { copyLayersPng } from '../exportPng';
import { ResizeCanvasModal } from '../ResizeCanvasModal';
import { RefImagePanel } from './RefImagePanel';
import styles from './Topbar.module.scss';

const COPIED_FEEDBACK_MS = 2000;

export function Topbar() {
  const {
    drawingId, title, canShare, groupName, canUndo, canRedo, onUndo, onRedo,
    activeLayerId, animationMode, layers, canvasWidth, canvasHeight, onCanvasResize, openPanel, onPanelToggle, onPanelClose,
    onLayerAdd, onLayerSelect, onLayerVisibilityToggle, onLayerDuplicate, onLayerDelete, onLayerReorder,
    onBack, onRename, refImage, getCommittedLayers,
  } = useEditorContext();
  const rename = useInlineRename({ currentName: title, onRename });

  const topbarRef = useRef<HTMLElement>(null);
  const [copied, setCopied] = useState(false);
  const [resizing, setResizing] = useState(false);
  const [sharing, setSharing] = useState<'invite' | 'link' | null>(null);
  const snackbar = useSnackbar();

  // La coche ne s'affiche que si le presse-papier a réellement accepté l'écriture.
  const copyWithFeedback = (copy: () => Promise<void>) => {
    // Appel synchrone (geste utilisateur exigé par iOS) ; sans presse-papier (contexte non sécurisé),
    // navigator.clipboard est undefined et l'appel lève avant toute promesse.
    let pending: Promise<void>;
    try {
      pending = copy();
    } catch (err) {
      pending = Promise.reject(err);
    }
    pending.then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), COPIED_FEEDBACK_MS);
      },
      () => snackbar.show('Échec de la copie'),
    );
  };

  // Les panneaux « color » et « export » gèrent leur propre fermeture.
  useOutsideDismiss({
    active: openPanel !== null && openPanel !== 'color' && openPanel !== 'export',
    refs: [topbarRef],
    onDismiss: onPanelClose,
  });

  return (
    <header ref={topbarRef} className={styles.topbar}>
      <div className={styles.identity}>
        <Button
          variant="ghost"
          iconOnly
          iconLeft="back"
          aria-label="Retour à la galerie"
          title="Retour à la bibliothèque"
          className={styles.back}
          onClick={onBack}
        />
        <div className={styles.titleGroup}>
          <span className={styles.crumb}>
            <Link to="/" className={styles.crumbLink}>Bibliothèque</Link>
            {groupName ? ` / ${groupName}` : null}
          </span>
          <div className={styles.titleRow}>
            {rename.isRenaming ? (
              <input
                autoFocus
                className={styles.renameInput}
                aria-label="Nom du dessin"
                maxLength={80}
                {...rename.inputProps}
              />
            ) : (
              <h1 className={styles.titleText}>
                <Button variant="ghost" className={styles.titleButton} title="Renommer le dessin" onClick={rename.start}>
                  {title}
                </Button>
              </h1>
            )}
            <Button
              variant="ghost"
              size="sm"
              className={styles.sizeChip}
              title="Modifier la taille du dessin"
              onClick={() => setResizing(true)}
            >
              {canvasWidth} × {canvasHeight} px
            </Button>
          </div>
        </div>
      </div>

      <div className={styles.actions}>
        <div className={styles.group}>
          <Button variant="ghost" iconOnly iconLeft="undo" title="Annuler (Ctrl+Z)" aria-label="Annuler" disabled={!canUndo} onClick={onUndo} />
          <Button variant="ghost" iconOnly iconLeft="redo" title="Rétablir (Ctrl+Y)" aria-label="Rétablir" disabled={!canRedo} onClick={onRedo} />
        </div>

        <span className={styles.separator} aria-hidden="true" />

        <div className={styles.toggles}>
          {!animationMode && (
            <div className={styles.slot}>
              <Button
                variant={openPanel === 'layers' ? 'selected' : 'selectable'}
                iconOnly
                iconLeft="layers"
                title="Calques"
                aria-label="Calques"
                aria-expanded={openPanel === 'layers'}
                onClick={() => onPanelToggle('layers')}
              />
              {openPanel === 'layers' && (
                <LayerPanel
                  layers={layers}
                  activeLayerId={activeLayerId}
                  canvasWidth={canvasWidth}
                  canvasHeight={canvasHeight}
                  onAdd={onLayerAdd}
                  onSelect={onLayerSelect}
                  onVisibilityToggle={onLayerVisibilityToggle}
                  onDuplicate={onLayerDuplicate}
                  onDelete={onLayerDelete}
                  onReorder={onLayerReorder}
                />
              )}
            </div>
          )}

          <div className={styles.slot}>
            <Button
              variant={openPanel === 'ref' ? 'selected' : 'selectable'}
              iconOnly
              iconLeft="reference"
              title="Image de référence"
              aria-label={refImage ? 'Image de référence (chargée)' : 'Image de référence'}
              aria-expanded={openPanel === 'ref'}
              onClick={() => onPanelToggle('ref')}
            />
            {refImage && <span className={styles.dot} aria-hidden="true" />}
            {openPanel === 'ref' && <RefImagePanel />}
          </div>
        </div>

        {canShare && (
          <Menu
            ariaLabel="Partager"
            triggerIcon="collaborators"
            triggerVariant="selectable"
            triggerSize="md"
            triggerTitle="Partager"
            items={[
              { label: 'Inviter…', icon: 'add', onClick: () => setSharing('invite') },
              { label: 'Partager un lien', icon: 'link', onClick: () => setSharing('link') },
            ]}
          />
        )}

        <Menu
          ariaLabel="Exporter"
          triggerIcon={copied ? 'check' : 'export'}
          triggerVariant={openPanel === 'export' ? 'selected' : 'secondary'}
          triggerSize="md"
          triggerTitle="Exporter"
          triggerLabel="Exporter"
          open={openPanel === 'export'}
          onOpenChange={(next) => { if (next) onPanelToggle('export'); else onPanelClose(); }}
          items={[
            {
              label: 'Copier en SVG',
              onClick: () => copyWithFeedback(() =>
                navigator.clipboard.writeText(buildLayersSvg(getCommittedLayers(), canvasWidth, canvasHeight))),
            },
            {
              label: 'Copier en PNG',
              onClick: () => copyWithFeedback(() => copyLayersPng(getCommittedLayers(), canvasWidth, canvasHeight)),
            },
          ]}
        />
      </div>
      {sharing === 'invite' && (
        <InviteCollaboratorModal
          target={{ kind: 'drawing', id: drawingId, title }}
          onClose={() => setSharing(null)}
          onInvited={(_userId, handle) => snackbar.show(`${handle} a été invité`, { icon: 'collaborators' })}
        />
      )}
      {sharing === 'link' && (
        <ShareLinkDialog drawingId={drawingId} title={title} onClose={() => setSharing(null)} />
      )}
      {resizing && (
        <ResizeCanvasModal
          width={canvasWidth}
          height={canvasHeight}
          onClose={() => setResizing(false)}
          onConfirm={(w, h) => { setResizing(false); onCanvasResize(w, h); }}
        />
      )}
    </header>
  );
}
