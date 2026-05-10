# Coding Style — PixelPerfect

## TypeScript
- Mode strict obligatoire (`"strict": true`).
- Pas d'`any`. Utiliser `unknown` et narrow.
- Types de retour explicites sur l'API publique des modules.
- Préférer `type` pour les props et unions, `interface` pour les contrats étendables.
- Imports via `@/` (alias `src/`). Pas de chemins relatifs `../../..`.

## React
- Composants fonctionnels uniquement.
- Props typées via `interface` ou `type` exporté.
- `forwardRef` quand le composant doit recevoir un ref DOM.
- Pas de `useEffect` pour calculer une valeur dérivable du state ou des props.

## SCSS
- **Toute valeur** (couleur, espace, taille, rayon, durée, z-index) → variable dans `src/styles/_variables.scss`.
- Aucun littéral magique dans les `.module.scss` (sauf `0`, `1`, `100%`).
- Variables et mixins disponibles partout via `additionalData` (cf. `vite.config.ts`) — ne pas réimporter manuellement.
- Un fichier `.module.scss` par composant, scopé via CSS Modules.
- Mobile-first ; utiliser les mixins `tablet-up` / `desktop-up`.
- Cibles tactiles ≥ 44×44 px (iOS).

## Composants
- Un composant = un dossier `src/components/<Name>/` avec `<Name>.tsx` + `<Name>.module.scss` + `index.ts`.
- API ergonomique : `variant`, `size`, `disabled`, etc. typés en union de littéraux.
- Pas de styles inline sauf valeur dynamique au runtime.

## Fichiers
- ≤ 400 lignes par fichier. Au-delà, extraire.
- Pas de `console.log` committé.
- Pas de bloc commenté.
- Commentaires uniquement quand le **pourquoi** n'est pas évident.

## Tests (à venir)
- Vitest + Testing Library côté unité quand le besoin se présente.
- Pas de mocks de la persistance dans les tests d'intégration : Supabase local ou stubbed côté réseau uniquement.
