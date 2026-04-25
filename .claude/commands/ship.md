---
description: Pre-ship checklist PixelPerfect
---

Exécute dans l'ordre :

1. `npm run type-check` — propre ?
2. `npm run build` — succès ?
3. `git diff --name-only` — pas de `console.log`, pas de TODO non rattaché à un ticket ?
4. Aucune valeur de style en dur dans les `.module.scss` (toutes les couleurs/espaces passent par `_variables.scss`) ?
5. Icônes PWA présentes dans `public/` (`pwa-192x192.png`, `pwa-512x512.png`, `apple-touch-icon.png`) ?
6. Métas iOS toujours dans `index.html` ?

Reporte : **READY TO SHIP** ou liste des bloquants.
