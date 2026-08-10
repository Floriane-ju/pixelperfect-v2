-- Instantané du schéma distant Supabase (projet Pixelperfect).
-- Source de vérité auditable pour les policies RLS, les triggers et les RPC.
-- Fichier de RÉFÉRENCE, pas une migration : il n'est jamais rejoué.
--
-- Régénérer après toute migration :  supabase db dump --linked -f supabase/schema.sql
--
-- Historique : ce schéma a longtemps vécu uniquement dans le dashboard Supabase
-- (supabase/migrations/ était gitignoré). Constat SEC-1 de audits/audit-2026-08-10.md.




SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."add_collaborator_by_handle"("d_id" "uuid", "handle_in" "text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  caller uuid := auth.uid();
  target uuid;
  is_owner boolean;
  trimmed text;
BEGIN
  IF caller IS NULL THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  PERFORM public.check_rate_limit('invite:' || caller::text, 20, 300);

  SELECT (owner_id = caller) INTO is_owner FROM public.drawings WHERE id = d_id;
  IF NOT COALESCE(is_owner, false) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  trimmed := trim(coalesce(handle_in, ''));
  IF position('@' IN trimmed) > 0 THEN
    SELECT id INTO target FROM auth.users WHERE lower(email) = lower(trimmed) LIMIT 1;
  ELSE
    SELECT user_id INTO target FROM public.profiles WHERE username = lower(trimmed) LIMIT 1;
  END IF;

  IF target IS NULL THEN
    RAISE EXCEPTION 'user_not_found' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.drawing_users (drawing_id, user_id, role)
  VALUES (d_id, target, 'editor')
  ON CONFLICT DO NOTHING;

  RETURN target;
END;
$$;


ALTER FUNCTION "public"."add_collaborator_by_handle"("d_id" "uuid", "handle_in" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_rate_limit"("p_key" "text", "p_max" integer, "p_window_seconds" integer) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  bucket timestamptz;
  prev_bucket timestamptz;
  total integer;
BEGIN
  bucket := to_timestamp(
    floor(extract(epoch FROM now()) / p_window_seconds) * p_window_seconds
  );
  prev_bucket := bucket - make_interval(secs => p_window_seconds);

  INSERT INTO public.rate_limits (key, window_start, count)
  VALUES (p_key, bucket, 1)
  ON CONFLICT (key, window_start)
  DO UPDATE SET count = public.rate_limits.count + 1
  RETURNING count INTO total;

  SELECT total + COALESCE(
    (SELECT count FROM public.rate_limits
     WHERE key = p_key AND window_start = prev_bucket),
    0
  ) INTO total;

  IF total > p_max THEN
    RAISE EXCEPTION 'rate_limit_exceeded' USING ERRCODE = '54000';
  END IF;

  DELETE FROM public.rate_limits
  WHERE key = p_key
    AND window_start < prev_bucket;
END;
$$;


ALTER FUNCTION "public"."check_rate_limit"("p_key" "text", "p_max" integer, "p_window_seconds" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_profile_for_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  INSERT INTO public.profiles (user_id, username)
  VALUES (NEW.id, public.derive_default_username(NEW.email))
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."create_profile_for_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."derive_default_username"("email_in" "text") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $_$
DECLARE
  base text;
  candidate text;
  suffix text;
  attempts int := 0;
BEGIN
  base := lower(coalesce(split_part(email_in, '@', 1), ''));
  base := regexp_replace(base, '[^a-z0-9_]+', '_', 'g');
  base := regexp_replace(base, '_+', '_', 'g');
  base := regexp_replace(base, '^_+|_+$', '', 'g');
  IF length(base) < 3 THEN
    base := 'user_' || substr(md5(random()::text || coalesce(email_in, '')), 1, 6);
  END IF;
  IF length(base) > 15 THEN
    base := substr(base, 1, 15);
  END IF;

  candidate := base;
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = candidate) LOOP
    attempts := attempts + 1;
    IF attempts > 20 THEN
      RAISE EXCEPTION 'cannot_derive_username';
    END IF;
    suffix := substr(md5(random()::text || coalesce(email_in, '') || attempts::text), 1, 4);
    candidate := substr(base, 1, 15) || '_' || suffix;
    IF length(candidate) > 20 THEN
      candidate := substr(candidate, 1, 20);
    END IF;
  END LOOP;

  RETURN candidate;
END;
$_$;


ALTER FUNCTION "public"."derive_default_username"("email_in" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."dissolve_group"("group_name_in" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
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


ALTER FUNCTION "public"."dissolve_group"("group_name_in" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_my_profile"() RETURNS TABLE("user_id" "uuid", "username" "text", "email" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  caller uuid := auth.uid();
BEGIN
  IF caller IS NULL THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT p.user_id, p.username, u.email::text
  FROM public.profiles p
  JOIN auth.users u ON u.id = p.user_id
  WHERE p.user_id = caller;
END;
$$;


ALTER FUNCTION "public"."get_my_profile"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_drawing_member"("d_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.drawings WHERE id = d_id AND owner_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM public.drawing_users WHERE drawing_id = d_id AND user_id = auth.uid()
  );
$$;


ALTER FUNCTION "public"."is_drawing_member"("d_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."list_collaborators"("d_id" "uuid") RETURNS TABLE("user_id" "uuid", "username" "text", "role" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  IF NOT public.is_drawing_member(d_id) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT du.user_id, p.username, du.role
  FROM public.drawing_users du
  LEFT JOIN public.profiles p ON p.user_id = du.user_id
  WHERE du.drawing_id = d_id
  ORDER BY (du.role = 'owner') DESC, p.username NULLS LAST;
END;
$$;


ALTER FUNCTION "public"."list_collaborators"("d_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."list_group_members"("group_name_in" "text") RETURNS TABLE("user_id" "uuid", "username" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
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


ALTER FUNCTION "public"."list_group_members"("group_name_in" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."remove_group_member"("group_name_in" "text", "user_id_in" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
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


ALTER FUNCTION "public"."remove_group_member"("group_name_in" "text", "user_id_in" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rename_group"("old_name_in" "text", "new_name_in" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
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


ALTER FUNCTION "public"."rename_group"("old_name_in" "text", "new_name_in" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."resolve_user_by_handle"("handle_in" "text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
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


ALTER FUNCTION "public"."resolve_user_by_handle"("handle_in" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."search_users_by_username_prefix"("prefix_in" "text", "limit_in" integer DEFAULT 10) RETURNS TABLE("user_id" "uuid", "username" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $_$
DECLARE
  caller uuid := auth.uid();
  normalized text;
  cap int;
BEGIN
  IF caller IS NULL THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  PERFORM public.check_rate_limit('search_users:' || caller::text, 60, 60);

  normalized := lower(trim(coalesce(prefix_in, '')));
  IF length(normalized) < 3 THEN
    RETURN;
  END IF;
  IF normalized !~ '^[a-z0-9_]+$' THEN
    RETURN;
  END IF;

  cap := greatest(1, least(coalesce(limit_in, 10), 20));

  RETURN QUERY
  SELECT p.user_id, p.username
  FROM public.profiles p
  WHERE p.username LIKE normalized || '%'
    AND p.user_id <> caller
  ORDER BY p.username
  LIMIT cap;
END;
$_$;


ALTER FUNCTION "public"."search_users_by_username_prefix"("prefix_in" "text", "limit_in" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_username"("new_username" "text") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $_$
DECLARE
  caller uuid := auth.uid();
  normalized text;
BEGIN
  IF caller IS NULL THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  PERFORM public.check_rate_limit('set_username:' || caller::text, 10, 300);
  normalized := lower(trim(coalesce(new_username, '')));
  IF normalized !~ '^[a-z0-9_]{3,20}$' THEN
    RAISE EXCEPTION 'invalid_username' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM public.profiles WHERE username = normalized AND user_id <> caller) THEN
    RAISE EXCEPTION 'username_taken' USING ERRCODE = '23505';
  END IF;
  UPDATE public.profiles
  SET username = normalized, updated_at = now()
  WHERE user_id = caller;
  RETURN normalized;
END;
$_$;


ALTER FUNCTION "public"."set_username"("new_username" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."share_group_by_handle"("group_name_in" "text", "handle_in" "text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
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


ALTER FUNCTION "public"."share_group_by_handle"("group_name_in" "text", "handle_in" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_group_shares"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
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


ALTER FUNCTION "public"."sync_group_shares"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."drawing_users" (
    "drawing_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "text" DEFAULT 'editor'::"text" NOT NULL,
    "via_group" "text",
    CONSTRAINT "drawing_users_role_check" CHECK (("role" = 'editor'::"text"))
);


ALTER TABLE "public"."drawing_users" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."drawings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" DEFAULT 'Untitled'::"text" NOT NULL,
    "data" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "group" "text",
    "owner_id" "uuid" DEFAULT "auth"."uid"() NOT NULL,
    CONSTRAINT "data_size_limit" CHECK (("pg_column_size"("data") < ((5 * 1024) * 1024)))
);


ALTER TABLE "public"."drawings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."group_users" (
    "owner_id" "uuid" NOT NULL,
    "group_name" "text" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."group_users" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "user_id" "uuid" NOT NULL,
    "username" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "profiles_username_check" CHECK (("username" ~ '^[a-z0-9_]{3,20}$'::"text"))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rate_limits" (
    "key" "text" NOT NULL,
    "window_start" timestamp with time zone NOT NULL,
    "count" integer DEFAULT 0 NOT NULL
);


ALTER TABLE "public"."rate_limits" OWNER TO "postgres";


ALTER TABLE ONLY "public"."drawing_users"
    ADD CONSTRAINT "drawing_users_pkey" PRIMARY KEY ("drawing_id", "user_id");



ALTER TABLE ONLY "public"."drawings"
    ADD CONSTRAINT "drawings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."group_users"
    ADD CONSTRAINT "group_users_pkey" PRIMARY KEY ("owner_id", "group_name", "user_id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_username_key" UNIQUE ("username");



ALTER TABLE ONLY "public"."rate_limits"
    ADD CONSTRAINT "rate_limits_pkey" PRIMARY KEY ("key", "window_start");



CREATE INDEX "drawing_users_user_id_idx" ON "public"."drawing_users" USING "btree" ("user_id");



CREATE INDEX "drawing_users_via_group_idx" ON "public"."drawing_users" USING "btree" ("via_group") WHERE ("via_group" IS NOT NULL);



CREATE INDEX "drawings_group_idx" ON "public"."drawings" USING "btree" ("group") WHERE ("group" IS NOT NULL);



CREATE INDEX "drawings_owner_id_idx" ON "public"."drawings" USING "btree" ("owner_id");



CREATE INDEX "drawings_updated_at_idx" ON "public"."drawings" USING "btree" ("updated_at" DESC);



CREATE INDEX "profiles_username_idx" ON "public"."profiles" USING "btree" ("username");



CREATE INDEX "rate_limits_window_start_idx" ON "public"."rate_limits" USING "btree" ("window_start");



CREATE OR REPLACE TRIGGER "drawings_sync_group_shares" AFTER INSERT OR UPDATE OF "group" ON "public"."drawings" FOR EACH ROW EXECUTE FUNCTION "public"."sync_group_shares"();



CREATE OR REPLACE TRIGGER "drawings_updated_at" BEFORE UPDATE ON "public"."drawings" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



ALTER TABLE ONLY "public"."drawing_users"
    ADD CONSTRAINT "drawing_users_drawing_id_fkey" FOREIGN KEY ("drawing_id") REFERENCES "public"."drawings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."drawing_users"
    ADD CONSTRAINT "drawing_users_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."drawings"
    ADD CONSTRAINT "drawings_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "auth"."users"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."group_users"
    ADD CONSTRAINT "group_users_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."group_users"
    ADD CONSTRAINT "group_users_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



CREATE POLICY "delete_owner" ON "public"."drawings" FOR DELETE TO "authenticated" USING (("owner_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "delete_self_or_owner" ON "public"."drawing_users" FOR DELETE TO "authenticated" USING ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) OR (EXISTS ( SELECT 1
   FROM "public"."drawings"
  WHERE (("drawings"."id" = "drawing_users"."drawing_id") AND ("drawings"."owner_id" = ( SELECT "auth"."uid"() AS "uid")))))));



ALTER TABLE "public"."drawing_users" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."drawings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."group_users" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "group_users_select" ON "public"."group_users" FOR SELECT USING ((("auth"."uid"() = "owner_id") OR ("auth"."uid"() = "user_id")));



CREATE POLICY "insert_authenticated" ON "public"."drawings" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "auth"."uid"() AS "uid") IS NOT NULL));



CREATE POLICY "insert_by_member" ON "public"."drawing_users" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_drawing_member"("drawing_id"));



ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "profiles_select_self" ON "public"."profiles" FOR SELECT TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



ALTER TABLE "public"."rate_limits" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "select_collab" ON "public"."drawings" FOR SELECT TO "authenticated" USING ("public"."is_drawing_member"("id"));



CREATE POLICY "select_member" ON "public"."drawing_users" FOR SELECT TO "authenticated" USING ("public"."is_drawing_member"("drawing_id"));



CREATE POLICY "update_collab" ON "public"."drawings" FOR UPDATE TO "authenticated" USING ("public"."is_drawing_member"("id")) WITH CHECK ("public"."is_drawing_member"("id"));





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";






















































































































































REVOKE ALL ON FUNCTION "public"."add_collaborator_by_handle"("d_id" "uuid", "handle_in" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."add_collaborator_by_handle"("d_id" "uuid", "handle_in" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."add_collaborator_by_handle"("d_id" "uuid", "handle_in" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."check_rate_limit"("p_key" "text", "p_max" integer, "p_window_seconds" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."check_rate_limit"("p_key" "text", "p_max" integer, "p_window_seconds" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."create_profile_for_user"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_profile_for_user"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."derive_default_username"("email_in" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."derive_default_username"("email_in" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."dissolve_group"("group_name_in" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."dissolve_group"("group_name_in" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_my_profile"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_my_profile"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_my_profile"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."is_drawing_member"("d_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."is_drawing_member"("d_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_drawing_member"("d_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."list_collaborators"("d_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."list_collaborators"("d_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."list_collaborators"("d_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."list_group_members"("group_name_in" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."list_group_members"("group_name_in" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."remove_group_member"("group_name_in" "text", "user_id_in" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."remove_group_member"("group_name_in" "text", "user_id_in" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."rename_group"("old_name_in" "text", "new_name_in" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."rename_group"("old_name_in" "text", "new_name_in" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."resolve_user_by_handle"("handle_in" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."resolve_user_by_handle"("handle_in" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."search_users_by_username_prefix"("prefix_in" "text", "limit_in" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."search_users_by_username_prefix"("prefix_in" "text", "limit_in" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."search_users_by_username_prefix"("prefix_in" "text", "limit_in" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."set_username"("new_username" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."set_username"("new_username" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_username"("new_username" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."share_group_by_handle"("group_name_in" "text", "handle_in" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."share_group_by_handle"("group_name_in" "text", "handle_in" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."sync_group_shares"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."sync_group_shares"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at"() TO "service_role";


















GRANT ALL ON TABLE "public"."drawing_users" TO "anon";
GRANT ALL ON TABLE "public"."drawing_users" TO "authenticated";
GRANT ALL ON TABLE "public"."drawing_users" TO "service_role";



GRANT ALL ON TABLE "public"."drawings" TO "anon";
GRANT ALL ON TABLE "public"."drawings" TO "authenticated";
GRANT ALL ON TABLE "public"."drawings" TO "service_role";



GRANT ALL ON TABLE "public"."group_users" TO "anon";
GRANT ALL ON TABLE "public"."group_users" TO "authenticated";
GRANT ALL ON TABLE "public"."group_users" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."profiles" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."rate_limits" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































