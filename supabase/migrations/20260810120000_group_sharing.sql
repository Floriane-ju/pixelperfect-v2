-- Partage d'un groupe entier.
--
-- Un groupe n'est pas une entité : c'est la colonne texte `drawings."group"`. Son identité est
-- donc le couple (owner_id, nom) — deux personnes peuvent avoir un groupe du même nom sans que
-- ce soit le même groupe.
--
-- `"group"` est un mot réservé SQL : toujours entre guillemets.
--
-- Aligné sur le schéma en place (vérifié) :
--   - `drawing_users_pkey` = (drawing_id, user_id) → cible des `on conflict` ci-dessous ;
--   - `drawing_users_role_check` n'autorise que 'editor' : le propriétaire se déduit de
--     `drawings.owner_id`, il n'a pas de ligne dans `drawing_users` ;
--   - résolution du handle et rate-limit repris à l'identique de
--     `add_collaborator_by_handle` (bucket `invite:<uid>`, 20 appels / 300 s — partager un
--     groupe consomme le même quota que les invitations individuelles).

-- 1. Membres d'un groupe.
create table if not exists public.group_users (
  owner_id   uuid not null references auth.users(id) on delete cascade,
  group_name text not null,
  user_id    uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (owner_id, group_name, user_id)
);

alter table public.group_users enable row level security;

-- Lecture seule côté client : toutes les écritures passent par les RPC `security definer`.
drop policy if exists group_users_select on public.group_users;
create policy group_users_select on public.group_users for select
  using (auth.uid() = owner_id or auth.uid() = user_id);

-- 2. Origine du partage : null = invitation individuelle, sinon nom du groupe dont il est hérité.
alter table public.drawing_users add column if not exists via_group text;

-- Les `on conflict (drawing_id, user_id)` ci-dessous s'appuient sur `drawing_users_pkey`.
create index if not exists drawing_users_via_group_idx
  on public.drawing_users (via_group) where via_group is not null;

-- 3. Résolution d'un pseudo ou d'un email → user_id.
--    Copie conforme de la résolution de `add_collaborator_by_handle` : email cherché dans
--    `auth.users`, pseudo dans `public.profiles` (username déjà stocké en minuscules).
create or replace function public.resolve_user_by_handle(handle_in text)
returns uuid
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  target  uuid;
  trimmed text := trim(coalesce(handle_in, ''));
begin
  if position('@' in trimmed) > 0 then
    select id into target from auth.users where lower(email) = lower(trimmed) limit 1;
  else
    select user_id into target from public.profiles where username = lower(trimmed) limit 1;
  end if;

  if target is null then
    raise exception 'user_not_found' using errcode = 'P0002';
  end if;
  return target;
end $$;

-- 4. Auto-partage et révocation quand le groupe d'un dessin change.
--    Seul point de passage commun à tous les chemins d'écriture (drag-drop, création dans un
--    groupe, re-synchronisation de la file offline).
create or replace function public.sync_group_shares()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  -- Le dessin quitte un groupe : on ne retire que les accès hérités de CE groupe.
  -- Une invitation individuelle (via_group null) n'est jamais touchée.
  if tg_op = 'UPDATE' and old."group" is not null
     and old."group" is distinct from new."group" then
    delete from drawing_users
     where drawing_id = new.id
       and via_group = old."group";
  end if;

  if new."group" is not null then
    insert into drawing_users (drawing_id, user_id, role, via_group)
    select new.id, gu.user_id, 'editor', new."group"
      from group_users gu
     where gu.owner_id = new.owner_id
       and gu.group_name = new."group"
    on conflict (drawing_id, user_id) do nothing;
  end if;

  return new;
end $$;

drop trigger if exists drawings_sync_group_shares on public.drawings;
create trigger drawings_sync_group_shares
  after insert or update of "group" on public.drawings
  for each row execute function public.sync_group_shares();

-- 5. Partager un groupe : ajoute le membre, puis partage rétroactivement les dessins déjà dedans.
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

-- 6. Membres d'un groupe (propriétaire uniquement).
create or replace function public.list_group_members(group_name_in text)
returns table (user_id uuid, username text)
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  if auth.uid() is null then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  return query
    select gu.user_id, p.username
      from group_users gu
      left join public.profiles p on p.user_id = gu.user_id
     where gu.owner_id = auth.uid()
       and gu.group_name = group_name_in
     order by p.username nulls last;
end $$;

-- 7. Retirer un membre : les accès hérités du groupe tombent, les invitations directes restent.
create or replace function public.remove_group_member(group_name_in text, user_id_in uuid)
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

  delete from group_users
   where owner_id = me and group_name = group_name_in and user_id = user_id_in;

  delete from drawing_users du
   using drawings d
   where du.drawing_id = d.id
     and d.owner_id = me
     and du.user_id = user_id_in
     and du.via_group = group_name_in;
end $$;

-- 8. Renommer un groupe : le nom est la clé des membres ET l'origine des partages hérités.
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

  -- Avant l'UPDATE des dessins : sinon le trigger verrait un groupe sans membres et
  -- révoquerait les partages hérités.
  update group_users
     set group_name = new_name_in
   where owner_id = me and group_name = old_name_in;

  update drawing_users du
     set via_group = new_name_in
    from drawings d
   where du.drawing_id = d.id
     and d.owner_id = me
     and du.via_group = old_name_in;

  update drawings
     set "group" = new_name_in, updated_at = now()
   where owner_id = me and "group" = old_name_in;
end $$;

-- 9. Dissoudre un groupe : dessins dégroupés (le trigger révoque), membres du groupe supprimés.
create or replace function public.dissolve_group(group_name_in text)
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

  update drawings
     set "group" = null, updated_at = now()
   where owner_id = me and "group" = group_name_in;

  delete from group_users
   where owner_id = me and group_name = group_name_in;
end $$;

-- Fonctions internes : `authenticated` est inclus explicitement, sinon les default privileges
-- Supabase lui accordent EXECUTE à la création. Un appel direct à `resolve_user_by_handle`
-- contournerait le rate-limit et donnerait un oracle d'existence sur les emails et pseudos.
revoke execute on function public.resolve_user_by_handle(text) from public, anon, authenticated;
revoke execute on function public.sync_group_shares() from public, anon, authenticated;
revoke execute on function public.share_group_by_handle(text, text) from anon;
revoke execute on function public.list_group_members(text) from anon;
revoke execute on function public.remove_group_member(text, uuid) from anon;
revoke execute on function public.rename_group(text, text) from anon;
revoke execute on function public.dissolve_group(text) from anon;

grant execute on function public.share_group_by_handle(text, text) to authenticated;
grant execute on function public.list_group_members(text) to authenticated;
grant execute on function public.remove_group_member(text, uuid) to authenticated;
grant execute on function public.rename_group(text, text) to authenticated;
grant execute on function public.dissolve_group(text) to authenticated;
