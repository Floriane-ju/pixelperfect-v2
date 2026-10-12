---
{
  "status": "open",
  "title": "Mode animation (calques = frames)",
  "opened": "2026-10-12",
  "closed": null,
  "commits": []
}
---

# Mode animation (calques = frames)

## Context
Demande : un « mode animation » activable dans les paramètres de l'éditeur, qui ajoute une timeline listant les calques comme frames, avec play/pause et choix de la vitesse.
Choix validés : pause = frame active + pelure d'oignon (frame précédente) ; mode et vitesse non persistés (état de session) ; calques masqués exclus de l'animation.

## Approche
Aucun changement de modèle de données. L'éditeur passe au `<Canvas>` une **vue dérivée** de `drawing.data` dont seuls `visible`/`opacity` des calques changent. Les `pixels` gardent la même référence → `useLayerComposite` ne re-rastérise rien, il recompose seulement (cheap à 24 fps). `onLayerChange` du Canvas ne transmet que `(layerId, pixels)` → aucun risque de persister la vue dérivée.

Ordre des frames = ordre de `data.layers` (index 0 = calque du bas = frame 1), filtré sur `visible`.

## Fichiers

### 1. `src/routes/Editor/animationFrames.ts` (+ `animationFrames.test.ts`)
Fonctions pures :
- `frameIds(layers): string[]` → ids des calques visibles, dans l'ordre.
- `animationLayers(layers, { shownId, onionId }): PixelLayer[]` → `shownId` garde son état (visible/opacité d'origine), `onionId` visible avec `opacity * ONION_OPACITY` (constante 0.3), autres `visible: false`.
- `previousFrameId(frames, id)` → frame précédente (boucle sur la dernière ; `null` si < 2 frames ou id hors frames).
Tests Vitest co-localisés (ordre, exclusion des masqués, oignon, boucle, cas 0/1 frame).

### 2. `src/routes/Editor/hooks/useAnimationPlayback.ts`
`useAnimationPlayback({ frames, fps, playing }) → { frameId }` : `setInterval(1000 / fps)` qui avance un index modulo `frames.length` tant que `playing` ; reset si les frames changent. Rien d'autre.

### 3. `src/routes/Editor/Timeline/` (`Timeline.tsx` + `.module.scss` + `index.ts`)
Bande sous le canvas (entre `.canvasArea` et `<StatusBar>` dans `Editor.tsx`) :
- `<Button>` play/pause (`aria-pressed`, label « Lire » / « Pause »), désactivé si < 2 frames.
- Liste horizontale scrollable de frames : `<Button variant="selectable"|"selected">` avec `LayerThumbnail` (réutilisé de `LayerPanel/LayerThumbnail.tsx`) + numéro en Silkscreen ; `aria-current` sur la frame affichée. Clic → pause + `setActiveLayerId`.
- `<Slider>` vitesse 1–24 img/s (défaut 8), `valueLabel` « N img/s ».
- Styles via tokens/mixins existants (`ink-titlebar`/`layer-surface`, `text-meta`), nouvelles valeurs dans `_variables.scss` (hauteur timeline, taille vignette). Cibles ≥ 44 px.

### 4. `src/routes/Editor/SettingsPanel/SettingsPanel.tsx`
Nouvelle section « Animation » : `<Switch>` « Mode animation » (props `animationMode`, `onAnimationModeToggle`), même pattern que la grille. Passe par `settings` de `ToolDock` sans autre changement.

### 5. `src/routes/Editor/Icons` → `src/components/Icons/Icons.tsx`
Ajouter `play` et `pause` dans `ICON_PATHS`.

### 6. `src/routes/Editor/Editor.tsx`
- State : `animationMode`, `playing`, `fps`.
- `frames = useMemo(frameIds(layers))`, `{ frameId } = useAnimationPlayback(...)`.
- `canvasData = useMemo` : mode off → `drawing.data` ; lecture → `animationLayers(..., { shownId: frameId, onionId: null })` ; pause → `{ shownId: activeLayerId, onionId: previousFrameId(frames, activeLayerId) }`.
- Pause → `setActiveLayerId(frameId)` (on s'arrête sur l'image affichée).
- Pendant la lecture : classe `.playing { pointer-events: none }` sur `.canvasArea` (pas de dessin sur une frame qui défile). Désactivation du mode → `playing = false`.
- Le fichier est à 318 lignes : la logique ci-dessus reste < 30 lignes ; si ça dépasse 400, déplacer le calcul de `canvasData` dans `useAnimationPlayback`.

### 7. Divers
- Bump `package.json` 0.11.2 → 0.12.0.
- Proposer une ligne dans `.claude/CLAUDE.md` (Architecture › Editor : `Timeline`, `animationFrames`).

## Hors périmètre (ponytail)
Export GIF, oignon multi-frames/réglable, durée par frame, raccourci clavier espace. À ajouter si demandé.

## Vérification
- `pnpm run test` (nouveaux tests `animationFrames.test.ts` + existants), `pnpm run type-check`, `pnpm run lint`.
- Manuel (par Floriane) : activer le mode dans Paramètres → timeline apparaît ; play/pause, vitesse, clic frame ; pause montre frame active + précédente en transparence ; calque masqué absent de la timeline ; dessin bloqué pendant la lecture, OK en pause ; désactiver le mode → composition normale.
