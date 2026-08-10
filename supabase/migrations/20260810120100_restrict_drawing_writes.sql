-- Restreint au propriétaire les écritures sensibles sur `drawings` et `drawing_users`.
--
-- Deux failles, même racine : la policy `update_collab` est
--   for update to authenticated using (is_drawing_member(id)) with check (is_drawing_member(id))
-- sans aucune restriction de colonne, et `is_drawing_member` rend vrai pour le propriétaire
-- OU un collaborateur. RLS étant row-level, une policy ne peut pas restreindre une colonne :
-- il faut un garde-fou explicite.
--
-- 1. Vol de propriété (critique). Un collaborateur `editor` pouvait réécrire
--    `drawings.owner_id` : le `with check` repassait après coup puisqu'il restait membre.
--    Aucune fonctionnalité de transfert de propriété n'existe dans le produit.
--
-- 2. Sabotage du partage de groupe. Un `editor` pouvait écrire `drawings."group"`, ce qui
--    déclenche `drawings_sync_group_shares` dont la branche
--      delete from drawing_users where drawing_id = new.id and via_group = old."group"
--    purge les accès hérités de TOUS les autres collaborateurs.
--
-- 3. `insert_by_member` sur `drawing_users` était `with check is_drawing_member(drawing_id)` :
--    tout membre pouvait insérer un collaborateur arbitraire, court-circuitant les contrôles
--    de `add_collaborator_by_handle` (rate-limit, résolution du pseudo, refus de l'auto-invitation).
--
-- Choix d'implémentation : trigger BEFORE UPDATE plutôt que privilèges de colonne
-- (`revoke update … grant update (cols) …`). Les privilèges de colonne sont binaires — ils
-- s'appliquent à tout le rôle `authenticated` — alors que la règle dépend de l'identité de
-- l'appelant : le propriétaire doit garder le droit d'écrire `"group"` (`moveToGroup`,
-- `removeFromGroup` dans `src/lib/drawings.ts`), le collaborateur non. Seul un trigger
-- peut distinguer les deux.
--
-- Ce que le trigger NE casse PAS, vérifié appel par appel dans `src/lib/drawings.ts` :
--   - collaborateur : `updateDrawingData` (data) et `renameDrawing` (title) — la collaboration
--     reste entière, c'est le cœur du produit ;
--   - propriétaire : `moveToGroup`, `removeFromGroup`, `renameDrawing`, `updateDrawingData`.
--
-- Les RPC `security definer` (`rename_group`, `dissolve_group`) déclenchent bien ce trigger —
-- un trigger se déclenche quel que soit l'appelant, `security definer` n'exempte que de RLS,
-- pas des triggers. Elles passent parce qu'elles filtrent déjà sur `owner_id = auth.uid()`,
-- donc la branche « propriétaire » s'applique. Toute RPC future qui écrirait le dessin d'un
-- autre utilisateur se ferait refuser : c'est voulu.

create or replace function public.enforce_drawing_write_rules()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  caller uuid := auth.uid();
begin
  -- Pas d'utilisateur authentifié : appel `service_role` ou tâche d'administration, qui
  -- contourne déjà RLS par conception. On ne s'y oppose pas.
  if caller is null then
    return new;
  end if;

  -- Le propriétaire garde la main sur toutes les colonnes.
  if old.owner_id = caller then
    return new;
  end if;

  if new.owner_id is distinct from old.owner_id then
    raise exception 'forbidden: owner_id is not writable by collaborators'
      using errcode = '42501';
  end if;

  if new."group" is distinct from old."group" then
    raise exception 'forbidden: group is not writable by collaborators'
      using errcode = '42501';
  end if;

  return new;
end $$;

alter function public.enforce_drawing_write_rules() owner to "postgres";

revoke execute on function public.enforce_drawing_write_rules() from public, anon, authenticated;

-- PostgreSQL déclenche les triggers BEFORE par ordre alphabétique de nom :
-- `drawings_enforce_write_rules` passe donc avant `drawings_updated_at`. Sans conséquence de
-- toute façon — l'autre ne fait que poser `updated_at = now()`, et une exception ici annule
-- l'instruction entière quel que soit l'ordre.
drop trigger if exists drawings_enforce_write_rules on public.drawings;
create trigger drawings_enforce_write_rules
  before update on public.drawings
  for each row
  execute function public.enforce_drawing_write_rules();

-- Resserre l'insertion de collaborateurs au seul propriétaire du dessin.
-- Sans risque de régression : aucun code client n'insère dans `drawing_users`
-- (seuls un `select` de comptage et le `delete` de `removeCollaborator` existent), et les
-- chemins légitimes — `add_collaborator_by_handle`, `share_group_by_handle`, le trigger
-- `sync_group_shares` — sont `security definer` appartenant à `postgres`, propriétaire de la
-- table, donc non soumis à RLS (aucun `force row level security` n'est activé).
drop policy if exists "insert_by_member" on public.drawing_users;

create policy "insert_by_owner" on public.drawing_users
  for insert to authenticated
  with check (exists (
    select 1
      from public.drawings d
     where d.id = drawing_users.drawing_id
       and d.owner_id = (select auth.uid())
  ));
