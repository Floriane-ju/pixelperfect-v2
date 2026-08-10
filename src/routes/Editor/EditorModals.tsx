import { ConfirmModal } from '@/components/ConfirmModal';

export interface EditorModalsProps {
  showInvisibleLayer: boolean;
  onInvisibleLayerCancel: () => void;
  onInvisibleLayerConfirm: () => void;
  showCapture: boolean;
  onCaptureCancel: () => void;
  onCaptureConfirm: () => void;
}

/**
 * Les confirmations de l'éditeur, regroupées pour tenir `EditorReady` sous la limite de
 * 400 lignes. Purement présentationnel : l'état vit dans `EditorReady`.
 */
export function EditorModals({
  showInvisibleLayer,
  onInvisibleLayerCancel,
  onInvisibleLayerConfirm,
  showCapture,
  onCaptureCancel,
  onCaptureConfirm,
}: EditorModalsProps) {
  return (
    <>
      {showInvisibleLayer && (
        <ConfirmModal
          message="Ce calque est masqué. Voulez-vous l'afficher pour pouvoir dessiner dessus ?"
          confirmLabel="Afficher le calque"
          onCancel={onInvisibleLayerCancel}
          onConfirm={onInvisibleLayerConfirm}
        />
      )}

      {showCapture && (
        <ConfirmModal
          message="Cette action remplit le calque actif avec les couleurs de la référence et écrase les pixels existants. Continuer ?"
          confirmLabel="Capturer"
          onCancel={onCaptureCancel}
          onConfirm={onCaptureConfirm}
        />
      )}
    </>
  );
}
