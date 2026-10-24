-- 0003_rls.sql
-- Row level security.
--  * Catalog (genres, venues, artists, events, event_genres, event_artists):
--    anon + authenticated may SELECT (events only when published or cancelled; join rows
--    only for those events; search_events still returns published only). Only service_role (BYPASSRLS) writes.
--  * profiles, favorites: owner-only via auth.uid().

grant usage on schema public to anon, authenticated, service_role;

alter table public.genres        enable row level security;
alter table public.venues        enable row level security;
alter table public.artists       enable row level security;
alter table public.events        enable row level security;
alter table public.event_genres  enable row level security;
alter table public.event_artists enable row level security;
alter table public.profiles      enable row level security;
alter table public.favorites     enable row level security;

-- Privileges (Supabase grants ALL to anon/authenticated by default; tighten it).
revoke all on public.genres, public.venues, public.artists, public.events,
              public.event_genres, public.event_artists
  from anon, authenticated;
grant select on public.genres, public.venues, public.artists, public.events,
                public.event_genres, public.event_artists
  to anon, authenticated;

revoke all on public.profiles, public.favorites from anon, authenticated;
grant select, insert, update, delete on public.profiles, public.favorites to authenticated;

grant all on all tables in schema public to service_role;

-- Catalog read policies ------------------------------------------------------
create policy genres_public_read on public.genres
  for select to anon, authenticated using (true);

-- Venues are readable regardless of status (closed venues keep their history page).
create policy venues_public_read on public.venues
  for select to anon, authenticated using (true);

create policy artists_public_read on public.artists
  for select to anon, authenticated using (true);

create policy events_public_read on public.events
  for select to anon, authenticated using (status in ('published', 'cancelled'));

create policy event_genres_public_read on public.event_genres
  for select to anon, authenticated
  using (exists (select 1 from public.events e
                 where e.id = event_genres.event_id and e.status in ('published', 'cancelled')));

create policy event_artists_public_read on public.event_artists
  for select to anon, authenticated
  using (exists (select 1 from public.events e
                 where e.id = event_artists.event_id and e.status in ('published', 'cancelled')));

-- Owner-only tables ----------------------------------------------------------
create policy profiles_owner_select on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy profiles_owner_insert on public.profiles
  for insert to authenticated with check (id = (select auth.uid()));
create policy profiles_owner_update on public.profiles
  for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy profiles_owner_delete on public.profiles
  for delete to authenticated using (id = (select auth.uid()));

create policy favorites_owner_select on public.favorites
  for select to authenticated using (user_id = (select auth.uid()));
create policy favorites_owner_insert on public.favorites
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy favorites_owner_update on public.favorites
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy favorites_owner_delete on public.favorites
  for delete to authenticated using (user_id = (select auth.uid()));

-- Functions ------------------------------------------------------------------
revoke execute on function public.search_events(
  double precision, double precision, double precision, text[], numeric,
  timestamptz, timestamptz, uuid, text, text, text, int, int, timestamptz) from public;
grant execute on function public.search_events(
  double precision, double precision, double precision, text[], numeric,
  timestamptz, timestamptz, uuid, text, text, text, int, int, timestamptz)
  to anon, authenticated, service_role;
grant execute on function public.haversine_km(double precision, double precision, double precision, double precision)
  to anon, authenticated, service_role;
grant execute on function public.fold_text(text) to anon, authenticated, service_role;
