# PixelPerfect — Fonctionnalités

---

## Éditeur

### Outils de dessin
- **Crayon** — dessin pixel par pixel avec taille de brosse variable (1–16 px)
- **Gomme** — efface les pixels du calque actif, avec une brosse variable (même taille que le crayon)
- **Remplissage** — remplit une zone connexe de même couleur (flood-fill)
- **Sélection** — sélectionne une région rectangulaire et permet de la déplacer
- **Ligne** — trace une ligne droite entre deux points
- **Cercle** — trace un cercle par boîte englobante

### Modes et effets
- Miroir horizontal et vertical (symétrie des tracés en temps réel)
- Grille de pixels affichable/masquable au dessus du dessin
- Zoom (Ctrl/Cmd+/−, molette, pinch trackpad)
- Pan (Espace + glisser, bouton central souris)
- Rotation du canvas (geste deux doigts)

### Brosse et couleurs
- Sélecteur de couleur visuel
- Ajout de couleurs dans une palette par valeur hexadécimale
- Palette auto-générée depuis toutes les couleurs du dessin à l'ouverture de celui-ci
- Fusion de couleurs par glisser-déposer dans la palette
- Pipette : maintien long (500 ms) pour échantillonner une couleur sur le canvas

### Gestion des calques
- Ajout, suppression, duplication de calques (1 calque minimum)
- Réorganisation par glisser-déposer (support tactile)
- Renommage par double-clic
- Visibilité et opacité par calque (0–100 %)
- Miniatures en temps réel de chaque calque
- Alerte si on dessine sur un calque masqué

### Image de référence
- Import d'une image comme référence visuelle
- Contrôle de position (X/Y), zoom (0,25×–4×) et opacité
- Tracé automatique : conversion de la référence en pixels de la grille de dessin
- Suppression de la référence

### Annulation / Rétablissement
- Undo/Redo complet (Ctrl/Cmd+Z / Ctrl/Cmd+Shift+Z)
- Geste deux doigts pour annuler (style Procreate)

### Export
- Export SVG copié dans le presse-papier

### Raccourcis clavier
| Touche | Action |
|--------|--------|
| `P` | Crayon |
| `E` | Gomme |
| `S` | Sélection |
| `L` | Ligne |
| `O` | Cercle |
| `Ctrl/Cmd+Z` | Annuler |
| `Ctrl/Cmd+Shift+Z` | Rétablir |
| `Espace` | Mode pan |
| `Ctrl/Cmd +/−` | Zoom |
| `Escape` | Annuler sélection |
| `Enter` | Valider sélection |

---

## Galerie

### Gestion des dessins
- Grille de dessins avec miniatures en temps réel
- Création de nouveau dessin : tailles prédéfinies (16×16, 32×32, 56×56, 64×64) ou dimensions personnalisées
- Renommage et suppression (menu contextuel)
- Tri par date de dernière modification

### Groupes
- Création de groupes par glisser-déposer de deux dessins
- Renommage et dissolution de groupe
- Déplacement d'un dessin d'un groupe à un autre par drag & drop
- Fenêtre de groupe flottante et déplaçable
- Création de nouveau dessin directement dans un groupe

---

## Persistance

### Cloud (Supabase)
- Sauvegarde et chargement des dessins en base PostgreSQL
- Horodatage automatique à chaque sauvegarde
- Accès direct par URL (`/editor/{id}`)

### Hors ligne
- File d'attente localStorage quand le réseau est indisponible
- Synchronisation automatique au retour de la connectivité

---

## Authentification
- Protection optionnelle par mot de passe (variable `VITE_APP_PASSWORD`)
- Session persistante dans `sessionStorage`

---

## PWA
- Service Worker (Workbox) pour le mode hors ligne
- Manifest Web App — installable sur l'écran d'accueil
- Icône Apple Touch Icon
- Support complet des gestes tactiles

---

## Modèle de données
- Dessin multi-calques, chaque calque stocke les pixels en map sparse (`"x,y"` → couleur hex)
- Dimensions de canvas : 1×1 à 512×512 px
- Stockage JSON en base Supabase avec métadonnées (titre, groupe, dates)
