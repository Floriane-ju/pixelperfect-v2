-- Lien public en lecture seule : `drawings.share_token` non nul = dessin consultable par
-- quiconque possède le lien `/p/<token>`. Désactiver le lien remet le jeton à null ; le
-- réactiver en génère un nouveau, l'ancien lien cesse de fonctionner.
--
-- Le jeton n'est pas l'id du dessin : les collaborateurs connaissent l'id, et un lien révoqué
-- doit le rester.

alter table public.drawings add column if not exists share_token uuid;

create unique index if not exists drawings_share_token_idx
  on public.drawings (share_token) where share_token is not null;

-- `update_collab` autorise tout membre à modifier la ligne : seul le propriétaire peut
-- publier ou retirer le lien.
create or replace function public.guard_share_token()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $$
begin
  if new.share_token is distinct from old.share_token
     and old.owner_id is distinct from auth.uid() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return new;
end $$;

drop trigger if exists drawings_guard_share_token on public.drawings;
create trigger drawings_guard_share_token
  before update of share_token on public.drawings
  for each row execute function public.guard_share_token();

-- Lecture publique : uniquement par jeton, uniquement titre et contenu (ni propriétaire,
-- ni groupe, ni collaborateurs).
create or replace function public.get_public_drawing(token_in uuid)
returns table (title text, data jsonb)
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  select d.title, d.data
    from drawings d
   where token_in is not null
     and d.share_token = token_in;
$$;

revoke execute on function public.guard_share_token() from public, anon, authenticated;
revoke execute on function public.get_public_drawing(uuid) from public;
grant execute on function public.get_public_drawing(uuid) to anon, authenticated;
