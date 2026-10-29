-- 0008: accent-insensitive artist search + search_path hardening.
--
-- SeedRepo.searchArtists folds accents ("mare" finds "Maré"); the PostgREST ilike filter SupabaseRepo used
-- did not. This RPC folds both sides with fold_text, like search_events does.

create or replace function public.search_artists(p_query text, p_limit int default 10)
returns setof public.artists
language sql stable
set search_path = public, pg_catalog
as $$
  select a.*
    from public.artists a
   where nullif(btrim(p_query), '') is not null
     and strpos(public.fold_text(a.name), public.fold_text(btrim(p_query))) > 0
   order by a.name
   limit greatest(1, least(coalesce(p_limit, 10), 50))
$$;

revoke all on function public.search_artists(text, int) from public;
grant execute on function public.search_artists(text, int) to anon, authenticated, service_role;

-- Advisor 0011: pin search_path on the pure helpers (none of them reads tables).
alter function public.haversine_km(double precision, double precision, double precision, double precision)
  set search_path = pg_catalog;
alter function public.fold_text(text) set search_path = pg_catalog;
alter function public.valid_review_topics(jsonb) set search_path = public, pg_catalog;
alter function public.valid_review_tags(text[]) set search_path = public, pg_catalog;
