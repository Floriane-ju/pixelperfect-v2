---
{
  "id": "T-0005",
  "titre": "Persister mode animation, vitesse et couleur de fond du dessin",
  "colonne": "fait",
  "priorite": "moyenne",
  "tags": ["editeur", "persistance"],
  "cree": "2026-10-12",
  "maj": "2026-10-12",
  "plan": null
}
---

## Contexte

Le mode animation, la vitesse (img/s) et la couleur de fond de l'éditeur sont de l'état React local :
ils repartent aux valeurs par défaut à chaque ouverture du dessin.

## Critères d'acceptation

- [ ] Ces trois réglages sont enregistrés avec le dessin (Supabase connecté, bibliothèque locale sinon).
- [ ] Rouvrir le dessin (autre appareil compris) restaure les réglages.
- [ ] Réglages absents ou invalides : valeurs par défaut, le dessin reste lisible.
- [ ] Undo/redo ne modifie pas ces réglages.
