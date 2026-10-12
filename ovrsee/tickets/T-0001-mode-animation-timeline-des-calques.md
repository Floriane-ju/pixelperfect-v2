---
{
  "id": "T-0001",
  "titre": "Mode animation : timeline des calques",
  "colonne": "revue",
  "priorite": "moyenne",
  "tags": [
    "editeur",
    "ui"
  ],
  "cree": "2026-10-12",
  "maj": "2026-10-12",
  "plan": "2026-10-12-mode-animation-calques-frames.md"
}
---

## Contexte

Pas de moyen de prévisualiser une animation image par image. Les calques servent de frames.

## Critères d'acceptation

- [ ] Un interrupteur « Mode animation » dans les paramètres affiche une timeline sous le canvas.
- [ ] La timeline liste les calques visibles comme frames (ordre bas → haut), clic = sélection.
- [ ] Play/pause fait défiler les frames en boucle ; vitesse réglable 1–24 img/s.
- [ ] En pause : frame active + frame précédente en pelure d'oignon.
- [ ] Dessin bloqué pendant la lecture ; mode désactivé = composition normale.
- [ ] Tests `animationFrames.test.ts` verts, type-check et lint OK.
