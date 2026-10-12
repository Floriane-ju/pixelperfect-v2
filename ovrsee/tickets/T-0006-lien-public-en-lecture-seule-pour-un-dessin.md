---
{
  "id": "T-0006",
  "titre": "Lien public en lecture seule pour un dessin",
  "colonne": "en-cours",
  "priorite": "moyenne",
  "tags": ["partage", "supabase"],
  "cree": "2026-10-12",
  "maj": "2026-10-12",
  "plan": null
}
---

## Contexte

Un dessin Supabase ne se partage qu'avec des collaborateurs connectés. On veut pouvoir le rendre
public : un lien spécial montre le dessin (ou l'animation) sans rien permettre de modifier.

## Critères d'acceptation

- [ ] Menu d'un dessin (galerie, propriétaire connecté) : entrée « Partager un lien ».
- [ ] Éditeur : bouton « Partager » en haut à droite → menu « Inviter » / « Partager un lien ».
- [ ] Le dialogue active/désactive le lien et permet de le copier.
- [ ] `/p/<jeton>` affiche le dessin, ou joue l'animation, sans connexion et sans édition.
- [ ] Désactiver le lien rend l'ancien lien inopérant ; seul le propriétaire peut le changer.
