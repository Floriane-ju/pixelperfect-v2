/** Le serveur a refusé l'écriture sans erreur réseau (RLS : 0 ligne modifiée). Inutile de réessayer. */
export class SaveRejectedError extends Error {
  constructor() {
    super('Enregistrement refusé : dessin introuvable ou accès retiré');
    this.name = 'SaveRejectedError';
  }
}
