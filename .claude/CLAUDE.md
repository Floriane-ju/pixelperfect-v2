# PixelPerfect

## Overview
Application PWA de dessin pixel art, installable sur iPad, iPhone et Android. Deux espaces : **galerie** (gestion des dessins, groupes) et **éditeur** (canvas multi-calques avec outils de dessin).

## Stack
- React 18 + TypeScript (strict)
- Vite 5 + `vite-plugin-pwa` (Workbox, autoUpdate)
- React Router v6
- SCSS modules + variables partagées (`src/styles/_variables.scss`)
- Cible : navigateurs modernes evergreen, iOS Safari ≥ 16

## Commands
```bash
npm install
npm run dev          # serveur Vite
npm run build        # build prod (tsc + vite)
npm run preview      # prévisualiser le build
npm run type-check   # tsc --noEmit
```

## Architecture
```
src/
  main.tsx              # entrée React, RouterProvider
  router.tsx            # définition des routes
  AppLayout.tsx         # layout racine
  components/           # composants réutilisables (Button, Dropdown, …)
    <Name>/
      <Name>.tsx
      <Name>.module.scss
      index.ts
  routes/               # pages
    Gallery/
    Editor/
  styles/               # _variables, _mixins, global.scss
  types/                # types de domaine partagés
```

## Conventions
- **Toute valeur de style** (couleur, espace, taille, durée…) passe par une variable SCSS dans `src/styles/_variables.scss`. Pas de littéraux dans les modules.
- **Composants UI** systématiquement extraits en composant réutilisable dans `src/components/`. Un dossier par composant : `<Name>.tsx` + `<Name>.module.scss` + `index.ts`.
- Imports via l'alias `@/` (= `src/`).
- Pas d'`any`. Utiliser `unknown` puis narrower.
- Pas de `console.log` committé.
- Montée de version du package.json aorès toute modification

## PWA
- Manifest et service worker générés par `vite-plugin-pwa` (cf. `vite.config.ts`).
- Métas iOS dans `index.html` (`apple-touch-icon`, `apple-mobile-web-app-capable`, `viewport-fit=cover`).
- Icônes à fournir dans `public/` : `pwa-192x192.png`, `pwa-512x512.png`, `apple-touch-icon.png`.

## Règles
@.claude/rules/coding-style.md
@.claude/rules/pwa.md

## Roadmap
Voir `FEATURES.md` à la racine pour la liste complète des fonctionnalités cibles.
