# PixelPerfect

## Overview
Application PWA de dessin pixel art, installable sur iPad, iPhone et Android. Deux espaces : **galerie** (gestion des dessins, groupes, collaborateurs) et **éditeur** (canvas multi-calques avec outils de dessin). **Connexion optionnelle** : connecté → persistance Supabase (+ file offline IndexedDB) ; anonyme → bibliothèque locale durable dans IndexedDB (base `pixelperfect-library`) avec export/import JSON. Le choix du backend passe par le dispatcher `lib/drawingStore.ts`.

## Stack
- React 19 + TypeScript (strict)
- Vite 8 (Rolldown) + `vite-plugin-pwa` (Workbox, autoUpdate)
- React Router v8 (paquet `react-router`, `react-router-dom` supprimé en v8)
- SCSS modules + variables/mixins partagés (`src/styles/`, injectés via `additionalData`)
- Supabase (auth + Postgres + RLS) — `@supabase/supabase-js`
- Vitest + Testing Library + jsdom
- ESLint 9 + Prettier + Husky
- Cible : navigateurs modernes evergreen, iOS Safari ≥ 16

## Commands
```bash
pnpm install
pnpm run dev          # serveur Vite
pnpm run build        # build prod (tsc -b + vite build)
pnpm run preview      # prévisualiser le build
pnpm run type-check   # tsc --noEmit
pnpm run lint         # eslint .
pnpm run format       # prettier --write
pnpm run test         # vitest
ANALYZE=1 pnpm run build  # rollup-plugin-visualizer → dist/stats.html
```

## Env
- `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` obligatoires (cf. `src/lib/supabase.ts`).
- Version applicative injectée par Vite (`define: __APP_VERSION__` dans `vite.config.ts`, déclarée dans `src/vite-env.d.ts`).

## Architecture
```
src/
  main.tsx              # entrée React, RouterProvider
  router.tsx            # routes (login publique, reste sous AppLayout + ErrorBoundary ; pas de garde d'auth)
  AppLayout.tsx         # layout racine + SessionProvider + SnackbarProvider
  components/           # composants réutilisables (Button, Input, Switch, Slider, Snackbar,
                        #   ColorSwatch, ColorWheelIcon, BrushSizeSlider, Icons, Menu,
                        #   ErrorBoundary, SessionProvider, SnakeCanvas, Tooltip)
    <Name>/<Name>.tsx + <Name>.module.scss + index.ts
    Button/             # variantes primary|secondary|ghost|danger|selected|selectable|ink
                        #   (`ink` = sur fond encre : aria-pressed → papier, aria-current → rouge)
    Dock/               # colonne encre 64 px (logo, boutons `ink`, version en pied) ; Dock +
                        #   DockDivider, layout responsive (barre du haut sur téléphone) | rail
    Dialog/             # dialogue centré (voile tramé, barre de titre encre si `title`) — ConfirmModal, NewDrawing,
                        #   NewGroup, InviteCollaborator passent par lui
    Modal/              # modale flottante déplaçable + ModalHeader (barre encre, réutilisé par GroupModal)
    InlineConfirm/      # confirmation en place (carte, ligne de menu), layout row|column
    MembersMenu/        # menu des membres (collaborateurs d'un dessin, membres d'un groupe) + retrait
    SessionProvider/    # contexte session (useSession) — split Context/Provider/hook (cf. Snackbar)
  hooks/                # hooks transverses (useModalA11y, useOutsideDismiss, useAnchoredMenu,
                        #   useInlineRename, useDraggableModal)
  lib/                  # accès Supabase, persistance et utilitaires transverses
    supabase.ts         # client
    cx.ts               # concaténation de classes CSS (seul chemin autorisé)
    auth.ts             # session / login
    drawingStore.ts     # dispatcher : route CRUD vers Supabase (connecté) ou local (anonyme)
    drawings.ts         # CRUD Supabase + collaborateurs
    drawingValidation.ts # validation runtime partagée des DrawingData (remote + local + import)
    localLibrary.ts     # bibliothèque locale IndexedDB (base `pixelperfect-library`, owner LOCAL_OWNER) ;
                        #   API nommée comme `drawings.ts` (fetchDrawings, createDrawing…), à importer
                        #   en namespace (`import * as local`) ou avec alias
    libraryTransfer.ts  # export/import JSON de la bibliothèque locale (fusion, nouveaux IDs)
    groupDrawings.ts    # regroupement client des dessins par nom de groupe
    groupSharing.ts     # partage d'un groupe entier (RPC share_group_by_handle,
                        #   list_group_members, remove_group_member) — connecté uniquement.
                        #   L'auto-partage des dessins ajoutés au groupe vient d'un trigger
                        #   Postgres sur `drawings."group"`, pas du client.
    offlineQueue.ts     # file IndexedDB (migre les anciennes entrées localStorage)
  routes/
    Login/              # auth (route publique)
    Gallery/            # GalleryDock, GalleryStates (chargement/vide/erreur), liste, groupes,
                        #   modales (NewDrawing, NewGroup, Group, InviteCollaborator),
                        #   DrawingCard/GroupCard (gabarit commun `_card.scss`), DrawingThumbnail
    Editor/             # Canvas (+ overlays, hooks navigation/composite/sélection),
                        #   ToolDock (outils + popover taille pinceau à l'appui long, symétrie,
                        #   affichage), Topbar (+ RefImagePanel), ColorRail (+ ColorPicker),
                        #   StatusBar, LayerPanel, SettingsPanel, MirrorPanel, EditorContext, tools.ts,
                        #   hooks (useSave, useUndoRedo, useLayers, useSelection,
                        #   useColorPalette, useReferenceImage, useEditorShortcuts),
                        #   utilitaires (colorMerge, exportSvg, shapePixels) avec tests
  styles/               # _variables (tokens), _mixins, global.scss
  types/                # DrawingData, PixelLayer, DrawingRow, CollaboratorRole, HexColor

supabase/migrations/    # migrations SQL (RLS, RPC, triggers). Le schéma historique vit dans le
                        #   dashboard Supabase : faire `supabase db pull` pour en récupérer le
                        #   baseline avant d'écrire une nouvelle migration.
public/                 # icônes PWA + favicon
```

## Conventions
- **Toute valeur de style** (couleur, espace, taille, durée…) passe par une variable SCSS dans `src/styles/_variables.scss`. Pas de littéraux dans les modules.
- **Design system « direction 07 »** (papier, encre, un rouge) : papier `$paper` tramé, encre `$ink`,
  **un seul accent** `$red` réservé à l'action, l'état actif et le focus. Typo : Silkscreen
  (`$font-family-display`, titres/numéros), Archivo (texte), Space Mono (méta). Pas de rayon ni de
  flou : traits 1/2 px, ombres dures `$shadow-raised` / `$shadow-hover` / `$shadow-layer`, 120 ms.
  Utiliser les mixins plutôt que recopier : `raised-interactive` (survol −2 px, pressé +4 px),
  `layer-surface` (menus, popovers, dialogues), `ink-titlebar` / `ink-button` (fenêtres, dock),
  `paper-dots`, `checker`, `scrim`, `pixel-mark`, `text-meta`, `focus-ring`. Référence visuelle :
  artefact Design « PixelPerfect — refonte rétro pro », page Direction 07.
- **Composants UI** systématiquement extraits dans `src/components/`. Un dossier par composant : `<Name>.tsx` + `<Name>.module.scss` + `index.ts`.
- Imports via l'alias `@/` (= `src/`). Pas de `../../..`.
- Pas d'`any`. Utiliser `unknown` puis narrower.
- Pas de `console.log` committé.
- Bump du `version` dans `package.json` après toute modification fonctionnelle.
- Toujours réutiliser les composants existants (ex. `<Button>` plutôt qu'un `<button>` brut, `<Dialog>`
  ou `<Modal>` plutôt qu'un voile maison, `<InlineConfirm>` pour une confirmation en place).
- Classes CSS conditionnelles : toujours `cx()` (`@/lib/cx`), jamais de template ni de `filter(Boolean).join(' ')`.
- Types de props exportés et nommés `<Composant>Props` ; params/retours de hooks `Use<Nom>Params` / `Use<Nom>Return`.
- Validation runtime obligatoire pour toute donnée venant de Supabase (cf. `parseDrawingData` dans `lib/drawings.ts`).
- Quand un changement mérite une mise à jour de claude.md ou des rules, propose la.

## PWA
- Manifest et service worker générés par `vite-plugin-pwa` (cf. `vite.config.ts`, `registerType: 'autoUpdate'`).
- Métas iOS dans `index.html` (`apple-touch-icon`, `apple-mobile-web-app-capable`, `viewport-fit=cover`).
- Icônes dans `public/` : `pwa-192x192.png`, `pwa-512x512.png` (incluant variant `maskable`), `apple-touch-icon.png`.
- File offline : `src/lib/offlineQueue.ts` (IndexedDB `pixelperfect/offline-queue`).

## Règles
@.claude/rules/coding-style.md
@.claude/rules/pwa.md

## Roadmap
Voir `FEATURES.md` à la racine.
