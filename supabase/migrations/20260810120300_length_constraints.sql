-- SEC-6 : plafond serveur sur `drawings.title` et `drawings."group"`.
--
-- Les `maxLength={80}` de `DrawingCard.tsx`, `GroupCard.tsx` et `NewGroupModal.tsx` sont
-- purement cosmétiques : un appel direct à l'API PostgREST les ignore. Les colonnes sont des
-- `text`, donc sans limite pratique — un titre de plusieurs mégaoctets était acceptable.
-- Côté RPC, `share_group_by_handle` ne testait que la chaîne vide.
--
-- Les contraintes sont posées `not valid` : elles s'appliquent à toute insertion et à toute
-- mise à jour — ce qui est l'objectif de sécurité — sans balayer les lignes déjà en base.
-- C'est délibéré : le plafond n'ayant jamais existé côté serveur, une ligne trop longue a pu
-- être créée par un appel direct, et une migration qui échoue au déploiement pour cette raison
-- serait un remède pire que le mal.
--
-- Une fois les données vérifiées (et nettoyées si besoin) :
--   select id, length(title) from drawings where length(title) > 80;
--   select id, length("group") from drawings where length("group") > 80;
--   alter table public.drawings validate constraint drawings_title_length;
--   alter table public.drawings validate constraint drawings_group_length;
--
-- `"group"` est nullable : un `check` sur une valeur NULL rend NULL, donc passe. Pas besoin
-- de traiter le cas séparément.

alter table public.drawings
  add constraint drawings_title_length check (length(title) <= 80) not valid;

alter table public.drawings
  add constraint drawings_group_length check (length("group") <= 80) not valid;

-- Même plafond en tête de la RPC qui accepte un nom de groupe. La mesure porte sur la valeur
-- brute, pas sur sa version `trim`ée : c'est la valeur brute qui est écrite en base, donc la
-- seule que la contrainte `drawings_group_length` verra. Normaliser par `trim` ici casserait
-- au passage le rapprochement avec les groupes existants créés avec des espaces.
-- (`rename_group` reçoit le même traitement dans la migration 20260810120200.)
--
-- Seul le test de longueur est ajouté : le reste du corps est repris à l'identique.
create or replace function public.share_group_by_handle(group_name_in text, handle_in text)
returns uuid
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  me     uuid := auth.uid();
  target uuid;
begin
  if me is null then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  perform public.check_rate_limit('invite:' || me::text, 20, 300);

  if coalesce(trim(group_name_in), '') = '' then
    raise exception 'empty_group_name' using errcode = '22023';
  end if;
  if length(group_name_in) > 80 then
    raise exception 'group_name_too_long' using errcode = '22023';
  end if;

  target := public.resolve_user_by_handle(handle_in);
  if target = me then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  insert into group_users (owner_id, group_name, user_id)
  values (me, group_name_in, target)
  on conflict do nothing;

  insert into drawing_users (drawing_id, user_id, role, via_group)
  select d.id, target, 'editor', group_name_in
    from drawings d
   where d.owner_id = me
     and d."group" = group_name_in
  on conflict (drawing_id, user_id) do nothing;

  return target;
end $$;

alter function public.share_group_by_handle(text, text) owner to "postgres";

-- `create or replace` préserve les privilèges existants, mais on les réaffirme : une migration
-- doit décrire l'état final qu'elle garantit, pas dépendre de celui qu'elle a trouvé.
-- `anon` reste volontairement exclu.
grant execute on function public.share_group_by_handle(text, text) to authenticated, service_role;
revoke execute on function public.share_group_by_handle(text, text) from anon;
