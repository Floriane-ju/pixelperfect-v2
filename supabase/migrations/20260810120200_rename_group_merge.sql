-- `rename_group` : sémantique de fusion, et plafond de longueur sur le nouveau nom.
--
-- Problème 1 — le renommage cassait sur collision de membres.
-- La PK de `group_users` est `(owner_id, group_name, user_id)`. L'ancien corps faisait
--   update group_users set group_name = new_name_in
--    where owner_id = me and group_name = old_name_in;
-- Renommer A en B alors que B existe déjà et partage un membre avec A viole la PK :
--   groupe A = [alice, bob], groupe B = [bob, charlie], A → B
--   la ligne (me, A, bob) deviendrait (me, B, bob), déjà présente → 23505.
-- Et comme les trois `update` sont dans la même transaction, TOUT le renommage était annulé,
-- y compris `drawing_users.via_group` et `drawings."group"`. Côté UI, l'erreur brute remontait
-- via `renameGroup` (`src/lib/drawings.ts`) sans message compréhensible.
--
-- Correctif : supprimer d'abord les lignes de l'ancien groupe dont le membre appartient déjà
-- au groupe cible. Sémantique de fusion — le membre y est déjà, la ligne en doublon n'a pas
-- de raison d'exister. Renommer devient donc toujours possible, plutôt que de lever une
-- exception qui interdirait au propriétaire de réorganiser ses groupes.
--
-- `drawing_users` n'est pas concerné : sa PK est `(drawing_id, user_id)` et `via_group` n'est
-- qu'une colonne nullable sans contrainte d'unicité — la mise à jour ne peut pas y collisionner.
-- `dissolve_group` n'est pas concerné non plus : il supprime des lignes, il n'en renomme pas.
--
-- Problème 2 (SEC-6) — aucun plafond de longueur n'était appliqué côté serveur, le
-- `maxLength={80}` de l'UI étant purement cosmétique. La mesure porte sur la valeur brute et
-- non sur sa version `trim`ée : c'est elle qui est écrite en base, donc la seule que la
-- contrainte `drawings_group_length` verra. Le test de chaîne vide continue d'utiliser `trim`,
-- comme avant.

create or replace function public.rename_group(old_name_in text, new_name_in text)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if coalesce(trim(new_name_in), '') = '' then
    raise exception 'empty_group_name' using errcode = '22023';
  end if;
  if length(new_name_in) > 80 then
    raise exception 'group_name_too_long' using errcode = '22023';
  end if;

  -- Renommage vers le même nom : sortie immédiate. Sans ce garde-fou, le `delete` de fusion
  -- ci-dessous prendrait l'intersection du groupe avec lui-même et le viderait de tous ses
  -- membres. L'ancien corps s'en sortait par accident (l'`update` était un no-op).
  if old_name_in = new_name_in then
    return;
  end if;

  -- Fusion : le membre appartient déjà au groupe cible, sa ligne dans l'ancien groupe part.
  delete from group_users
   where owner_id = me
     and group_name = old_name_in
     and user_id in (
       select user_id
         from group_users
        where owner_id = me
          and group_name = new_name_in
     );

  update group_users
     set group_name = new_name_in
   where owner_id = me
     and group_name = old_name_in;

  update drawing_users du
     set via_group = new_name_in
    from drawings d
   where du.drawing_id = d.id
     and d.owner_id = me
     and du.via_group = old_name_in;

  update drawings
     set "group" = new_name_in, updated_at = now()
   where owner_id = me
     and "group" = old_name_in;
end $$;

alter function public.rename_group(text, text) owner to "postgres";

-- `create or replace` préserve les privilèges existants, mais on les réaffirme : une migration
-- doit décrire l'état final qu'elle garantit, pas dépendre de celui qu'elle a trouvé.
-- `anon` reste volontairement exclu.
grant execute on function public.rename_group(text, text) to authenticated, service_role;
revoke execute on function public.rename_group(text, text) from anon;
