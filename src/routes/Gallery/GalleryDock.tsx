import { Button } from '@/components/Button';
import { Dock } from '@/components/Dock';

export interface GalleryDockProps {
  isAuth: boolean;
  onImport: () => void;
  onExport: () => void;
  onLogin: () => void;
  onProfile: () => void;
  onSignOut: () => void;
}

/** Dock de la galerie : bibliothèque, puis import/export/connexion (anonyme) ou profil/déconnexion. */
export function GalleryDock({
  isAuth,
  onImport,
  onExport,
  onLogin,
  onProfile,
  onSignOut,
}: GalleryDockProps) {
  return (
    <Dock
      version={__APP_VERSION__}
      footer={
        isAuth ? (
          <Button
            variant="ink"
            iconOnly
            iconLeft="logout"
            aria-label="Se déconnecter"
            title="Se déconnecter"
            onClick={onSignOut}
          />
        ) : undefined
      }
    >
      <Button
        variant="ink"
        iconOnly
        iconLeft="library"
        aria-label="Bibliothèque"
        title="Bibliothèque"
        aria-current="page"
      />
      {isAuth ? (
        <Button
          variant="ink"
          iconOnly
          iconLeft="collaborators"
          aria-label="Profil"
          title="Profil"
          aria-haspopup="dialog"
          onClick={onProfile}
        />
      ) : (
        <>
          <Button
            variant="ink"
            iconOnly
            iconLeft="import"
            aria-label="Importer une bibliothèque"
            title="Importer"
            onClick={onImport}
          />
          <Button
            variant="ink"
            iconOnly
            iconLeft="export"
            aria-label="Exporter la bibliothèque"
            title="Exporter"
            onClick={onExport}
          />
          <Button
            variant="ink"
            iconOnly
            iconLeft="login"
            aria-label="Se connecter"
            title="Se connecter"
            onClick={onLogin}
          />
        </>
      )}
    </Dock>
  );
}
