---
{
  "id": "T-0004",
  "titre": "Réordonner les frames de la timeline par glisser-déposer",
  "colonne": "en-cours",
  "priorite": "moyenne",
  "tags": ["ui", "editeur"],
  "cree": "2026-10-12",
  "maj": "2026-10-12",
  "plan": null
}
---

## Contexte

En mode animation, l'ordre des frames suit l'ordre des calques, mais la timeline ne permet pas de le changer : il faut passer par le panneau Calques.

## Critères d'acceptation

- [ ] Chaque frame de la timeline porte une poignée de glisser-déposer.
- [ ] Glisser une frame avant/après une autre réordonne les calques correspondants (annulable, sauvegardé).
- [ ] Un indicateur montre la position de dépôt pendant le glissement.
- [ ] Le panneau Calques garde son comportement de glisser-déposer.
