# PixelPerfect

## Overview
Application PWA de dessin pixel art, installable sur iPad, iPhone et Android. Deux espaces : **galerie** (gestion des dessins, groupes, collaborateurs) et **éditeur** (canvas multi-calques avec outils de dessin). Persistance Supabase, file offline IndexedDB.

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
  router.tsx            # routes (login publique, reste sous RequireAuth + ErrorBoundary)
  AppLayout.tsx         # layout racine + SnackbarProvider
  components/           # composants réutilisables (Button, Input, Snackbar, ColorSwatch,
                        #   ColorWheelIcon, BrushSizeSlider, Icons, ErrorBoundary, RequireAuth)
    <Name>/<Name>.tsx + <Name>.module.scss + index.ts
  hooks/                # hooks transverses (useModalA11y)
  lib/                  # accès Supabase et persistance
    supabase.ts         # client
    auth.ts             # session / login
    drawings.ts         # CRUD + validation runtime des DrawingRow
    groupDrawings.ts    # groupes
    offlineQueue.ts     # file IndexedDB (migre les anciennes entrées localStorage)
  routes/
    Login/              # auth (route publique)
    Gallery/            # liste, groupes, modales (NewDrawing, NewGroup, Group,
                        #   InviteCollaborator), DrawingCard/Thumbnail, Menu
    Editor/             # Canvas (+ overlays, hooks navigation/composite/sélection),
                        #   Topbar, LayerPanel, ColorPicker, ContextMenu, EditorContext,
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
- Toujours réutiliser les composants existants (ex. `<Button>` plutôt qu'un `<button>` brut).
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
