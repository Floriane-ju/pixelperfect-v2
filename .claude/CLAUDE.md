# PixelPerfect

## Overview
Application PWA de dessin pixel art, installable sur iPad, iPhone et Android. Deux espaces : **galerie** (gestion des dessins, groupes, collaborateurs) et **éditeur** (canvas multi-calques avec outils de dessin). **Connexion optionnelle** : connecté → persistance Supabase (+ file offline IndexedDB) ; anonyme → bibliothèque locale durable dans IndexedDB (base `pixelperfect-library`) avec export/import JSON. Le choix du backend passe par le dispatcher `lib/drawingStore.ts`.

## Stack
- React 18 + TypeScript (strict)
- Vite 5 + `vite-plugin-pwa` (Workbox, autoUpdate)
- React Router v6
- SCSS modules + variables/mixins partagés (`src/styles/`, injectés via `additionalData`)
- Supabase (auth + Postgres + RLS) — `@supabase/supabase-js`
- Vitest + Testing Library + jsdom
- ESLint 9 + Prettier + Husky
- Cible : navigateurs modernes evergreen, iOS Safari ≥ 16

## Commands
```bash
npm install
npm run dev          # serveur Vite
npm run build        # build prod (tsc -b + vite build)
npm run preview      # prévisualiser le build
npm run type-check   # tsc --noEmit
npm run lint         # eslint .
npm run format       # prettier --write
npm run test         # vitest
ANALYZE=1 npm run build  # rollup-plugin-visualizer → dist/stats.html
```

## Env
- `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` obligatoires (cf. `src/lib/supabase.ts`).
- Version applicative importée à l'exécution depuis `package.json` (cf. `src/routes/Gallery/Gallery.tsx`).

## Architecture
```
src/
  main.tsx              # entrée React, RouterProvider
  router.tsx            # routes (login publique, reste sous AppLayout + ErrorBoundary ; pas de garde d'auth)
  AppLayout.tsx         # layout racine + SessionProvider + SnackbarProvider
  components/           # composants réutilisables (Button, Input, Switch, Slider, Snackbar,
                        #   ColorSwatch, ColorWheelIcon, BrushSizeSlider, Icons, Menu,
                        #   ErrorBoundary, SessionProvider)
    <Name>/<Name>.tsx + <Name>.module.scss + index.ts
    Dialog/             # dialogue centré (voile + clic extérieur) — ConfirmModal, NewDrawing,
                        #   NewGroup, InviteCollaborator passent par lui
    Modal/              # modale flottante déplaçable + ModalHeader (réutilisé par GroupModal)
    InlineConfirm/      # confirmation en place (carte, ligne de menu), layout row|column
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
    groupDrawings.ts    # groupes
    offlineQueue.ts     # file IndexedDB (migre les anciennes entrées localStorage)
  routes/
    Login/              # auth (route publique)
    Gallery/            # liste, groupes, modales (NewDrawing, NewGroup, Group,
                        #   InviteCollaborator), DrawingCard/Thumbnail, Menu
    Editor/             # Canvas (+ overlays, hooks navigation/composite/sélection),
                        #   Topbar, LayerPanel, ColorPicker, SettingsPanel, MirrorPanel, EditorContext,
                        #   hooks (useSave, useUndoRedo, useLayers, useSelection,
                        #   useColorPalette, useReferenceImage, useEditorShortcuts),
                        #   utilitaires (colorMerge, exportSvg, shapePixels) avec tests
  styles/               # _variables, _mixins, global.scss
  types/                # DrawingData, PixelLayer, DrawingRow, CollaboratorRole, HexColor

supabase/migrations/    # migrations SQL (RLS, RPC list_collaborators, ownership triggers)
public/                 # icônes PWA + favicon
```

## Conventions
- **Toute valeur de style** (couleur, espace, taille, durée…) passe par une variable SCSS dans `src/styles/_variables.scss`. Pas de littéraux dans les modules.
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
