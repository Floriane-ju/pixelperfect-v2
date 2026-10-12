-- Réglages d'affichage enregistrés avec le dessin : `data.settings` (cf. `DrawingSettings`).
--
-- Backfill des dessins existants : pas de mode animation, fond blanc, 8 img/s (valeurs par
-- défaut de l'éditeur). Un réglage déjà présent prime (`||` garde la valeur de droite) ;
-- un `settings` qui n'est pas un objet est remplacé.
--
-- `drawings_updated_at` est désactivé le temps du backfill : sinon chaque dessin paraîtrait
-- modifié maintenant, ce qui bouleverse le tri de la galerie et fait jeter par l'éditeur les
-- modifications hors-ligne pas encore synchronisées (entrée de file plus ancienne que le serveur).

alter table public.drawings disable trigger drawings_updated_at;

update public.drawings
   set data = jsonb_set(
     data,
     '{settings}',
     '{"animationMode": false, "bgColor": "white", "fps": 8}'::jsonb
       || (case when jsonb_typeof(data->'settings') = 'object' then data->'settings' else '{}'::jsonb end)
   )
 where jsonb_typeof(data) = 'object'
   and (data->'settings') is distinct from (
     '{"animationMode": false, "bgColor": "white", "fps": 8}'::jsonb
       || (case when jsonb_typeof(data->'settings') = 'object' then data->'settings' else '{}'::jsonb end)
   );

alter table public.drawings enable trigger drawings_updated_at;
