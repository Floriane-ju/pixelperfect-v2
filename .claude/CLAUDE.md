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
pnpm run test         # vitest (mode watch)
pnpm run test:run     # vitest run (one-shot, pour CI et pre-commit)
pnpm run test:coverage # couverture v8 — nécessite `pnpm add -D @vitest/coverage-v8`
ANALYZE=1 pnpm run build  # rollup-plugin-visualizer → dist/stats.html
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
    groupDrawings.ts    # regroupement client des dessins par nom de groupe
    groupSharing.ts     # partage d'un groupe entier (RPC share_group_by_handle,
                        #   list_group_members, remove_group_member) — connecté uniquement.
                        #   L'auto-partage des dessins ajoutés au groupe vient d'un trigger
                        #   Postgres sur `drawings."group"`, pas du client.
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

supabase/
  migrations/           # migrations SQL versionnées (RLS, RPC, triggers). Toujours exécuter
                        #   via `supabase migration new <name>` + `supabase db push` en dev.
  schema.sql            # instantané du schéma distant (audit, baseline). À régénérer via
                        #   `supabase db dump --linked -f supabase/schema.sql` après chaque
                        #   migration appliquée. Ne pas rejouer directement ; source de vérité.
  .temp/                # scratch du CLI (ignoré) ; ne pas committer
public/                 # icônes PWA + favicon
  fonts/                # Oxanium 400/600 et Press Start 2P en .woff2 auto-hébergés
                        #   (sous-ensembles latin et latin-ext seulement). Déclarés dans
                        #   `src/styles/_fonts.scss`, précachés par Workbox via `globPatterns`.
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

## Sécurité (vercel.json)
En production (Vercel), les headers HTTP suivants sont appliqués via `vercel.json` (à la racine) :
- **CSP** (Content-Security-Policy) : `default-src 'self'`, `script-src 'self'`, `font-src 'self'` (les polices sont auto-hébergées dans `public/fonts/`, aucun domaine tiers n'est autorisé), `connect-src` limité à Supabase, `object-src 'none'`, `frame-ancestors 'none'`.
- **HSTS** (max-age 63072000 + includeSubDomains + preload) : force HTTPS via preload list.
- **X-Frame-Options: DENY** : clickjacking mitigation.
- **X-Content-Type-Options: nosniff** : MIME-type sniffing prevention.
- **Permissions-Policy** : désactive camera, microphone, geolocation.
- **Referrer-Policy: strict-origin-when-cross-origin** : limite les infos de referer.
- **Rewrites SPA** : `/(.*) → /index.html` pour React Router.

## CI et Déploiement
Un workflow GitHub Actions (`.github/workflows/ci.yml`) valide chaque commit sur main et chaque PR :
1. **Install** : `pnpm install --frozen-lockfile` (vérifie que lockfile est à jour).
2. **Lint** : `pnpm run lint` (ESLint).
3. **Type check** : `pnpm run type-check` (TypeScript).
4. **Test** : `pnpm run test:run` (Vitest one-shot, pas mode watch).
5. **Build** : `pnpm run build` (Vite + tsc -b).

Secrets en CI : `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` (fallbacks sur des valeurs de test si non configurés).

## Règles
@.claude/rules/coding-style.md
@.claude/rules/pwa.md

## Roadmap
Voir `FEATURES.md` à la racine.
