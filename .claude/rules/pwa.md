# PWA Rules — PixelPerfect

## Installabilité
- `vite-plugin-pwa` configuré en `registerType: 'autoUpdate'`.
- Manifest dans `vite.config.ts` ; ne pas dupliquer dans `public/manifest.webmanifest`.
- Icônes obligatoires : `pwa-192x192.png`, `pwa-512x512.png` (dont une `purpose: 'maskable'`), `apple-touch-icon.png` (180×180).
- `index.html` doit garder les métas iOS : `apple-touch-icon`, `apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style`, `theme-color`, `viewport-fit=cover`.

## Tactile et gestes
- `touch-action` adapté par zone (le canvas désactive scroll/zoom natifs, le reste reste navigable).
- Utiliser les Pointer Events (`pointerdown`/`pointermove`/`pointerup`) pour le dessin — pas de `mouse*` ni `touch*` séparés.
- Bloquer le double-tap zoom et le pinch zoom sur le canvas, garder le pinch zoom applicatif.
- Respecter `env(safe-area-inset-*)` sur iPhone à encoche (mixins `safe-area-top`/`safe-area-bottom`).

## Offline
- Workbox cache `js/css/html/svg/png/ico/woff2` par défaut.
- Toute donnée utilisateur (dessins en cours) doit pouvoir tomber dans une file localStorage en cas d'échec réseau, puis se synchroniser.

## iOS particularités
- Pas de `100vh` (bug Safari) → utiliser `100dvh`.
- Pas de `prompt()` / `confirm()` natifs côté éditeur (UX cassée en standalone).
- Tester systématiquement en mode "Ajouter à l'écran d'accueil" avant de marquer une feature PWA terminée.
