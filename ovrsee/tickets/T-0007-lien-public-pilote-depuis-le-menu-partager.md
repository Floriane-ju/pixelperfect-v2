---
{
  "id": "T-0007",
  "titre": "Lien public piloté depuis le menu Partager",
  "colonne": "en-cours",
  "priorite": "moyenne",
  "tags": ["ui", "partage"],
  "cree": "2026-10-12",
  "maj": "2026-10-12",
  "plan": null
}
---

## Contexte

Activer le lien public ouvre une modale dédiée (`ShareLinkDialog`) : un clic de trop, alors que
l'interrupteur et la copie tiennent dans le menu.

## Critères d'acceptation

- [ ] Menu Partager (éditeur) et menu d'une carte (galerie, groupe) : item « Lien public » avec interrupteur intégré.
- [ ] Interrupteur actif → icône copier dans la même ligne, qui copie l'URL publique.
- [ ] `ShareLinkDialog` supprimée.
