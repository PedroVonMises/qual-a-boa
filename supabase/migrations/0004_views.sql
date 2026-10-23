-- 0004_views.sql
-- "Já passaram por aqui": artist history per venue and venue history per artist.
-- Only published events that started before p_now count. security invoker, so RLS applies.

create or replace function public.venue_past_artists(
  p_venue_id uuid,
  p_now      timestamptz default now()
)
returns table (
  artist_id          uuid,
  artist_slug        text,
  artist_name        text,
  artist_genre_slugs text[],
  artist_photo_url   text,
  last_played_at     timestamptz,
  times              int
)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select a.id, a.slug, a.name, a.genre_slugs, a.photo_url,
         max(e.starts_at)  as last_played_at,
         count(*)::int     as times
  from public.events e
  join public.event_artists ea on ea.event_id = e.id
  join public.artists a        on a.id = ea.artist_id
  where e.venue_id = p_venue_id
    and e.status = 'published'
    and e.starts_at < p_now
  group by a.id, a.slug, a.name, a.genre_slugs, a.photo_url
  order by max(e.starts_at) desc, a.name asc, a.id asc
$$;

create or replace function public.artist_played_at(
  p_artist_id uuid,
  p_now       timestamptz default now()
)
returns table (
  venue_id        uuid,
  venue_slug      text,
  venue_name      text,
  venue_area      text,
  venue_city      text,
  venue_status    public.venue_status,
  venue_cover_key text,
  last_played_at  timestamptz,
  times           int
)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select v.id, v.slug, v.name, v.area, v.city, v.status, v.cover_key,
         max(e.starts_at) as last_played_at,
         count(*)::int    as times
  from public.event_artists ea
  join public.events e on e.id = ea.event_id
  join public.venues v on v.id = e.venue_id
  where ea.artist_id = p_artist_id
    and e.status = 'published'
    and e.starts_at < p_now
  group by v.id, v.slug, v.name, v.area, v.city, v.status, v.cover_key
  order by max(e.starts_at) desc, v.name asc, v.id asc
$$;

revoke execute on function public.venue_past_artists(uuid, timestamptz) from public;
revoke execute on function public.artist_played_at(uuid, timestamptz) from public;
grant execute on function public.venue_past_artists(uuid, timestamptz) to anon, authenticated, service_role;
grant execute on function public.artist_played_at(uuid, timestamptz) to anon, authenticated, service_role;
