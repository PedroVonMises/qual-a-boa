-- 0006_catalog_ingest.sql
-- Catalog ingestion support (Wave 7): provenance columns on events, optional https poster image,
-- venue_aliases for matching ingested venue names, a relaxed cover_key check (generated covers use
-- keys like 'art:sun:p3:v1') and image_url carried through search_events.
-- All writes remain service_role only (RLS: anon/authenticated may only SELECT).

-- Events: provenance + image --------------------------------------------------
alter table public.events
  add column source      text,
  add column source_id   text,
  add column source_url  text constraint events_source_url_https check (source_url is null or source_url ~* '^https://[^@/]+(/|$)'),
  add column fetched_at  timestamptz,
  add column image_url   text constraint events_image_url_https check (image_url is null or image_url ~* '^https://[^@/]+(/|$)');

create unique index events_source_key_idx on public.events (source, source_id)
  where source is not null and source_id is not null;

-- cover_key: closed list -> pattern ---------------------------------------------
alter table public.venues drop constraint venues_cover_key_check;
alter table public.events drop constraint events_cover_key_check;
alter table public.venues add constraint venues_cover_key_check check (cover_key ~ '^[a-z0-9:_-]{1,48}$');
alter table public.events add constraint events_cover_key_check check (cover_key ~ '^[a-z0-9:_-]{1,48}$');

-- Venue aliases -----------------------------------------------------------------
create table public.venue_aliases (
  venue_id  uuid not null references public.venues (id) on delete cascade,
  alias     text not null check (btrim(alias) <> ''),
  constraint venue_aliases_alias_key unique (alias)
);
create index venue_aliases_venue_idx on public.venue_aliases (venue_id);

alter table public.venue_aliases enable row level security;
revoke all on public.venue_aliases from anon, authenticated;
grant select on public.venue_aliases to anon, authenticated;
grant all on public.venue_aliases to service_role;
create policy venue_aliases_public_read on public.venue_aliases
  for select to anon, authenticated using (true);

-- search_events: add image_url (return type changes, so drop and recreate) -------
drop function public.search_events(
  double precision, double precision, double precision, text[], numeric,
  timestamptz, timestamptz, uuid, text, text, text, int, int, timestamptz);

create function public.search_events(
  p_lat         double precision,
  p_lng         double precision,
  p_radius_km   double precision,
  p_genre_slugs text[]      default null,
  p_price_max   numeric     default null,
  p_date_from   timestamptz default null,
  p_date_to     timestamptz default null,
  p_artist_id   uuid        default null,
  p_area        text        default null,
  p_query       text        default null,
  p_sort        text        default 'date',
  p_limit       int         default 20,
  p_offset      int         default 0,
  p_now         timestamptz default now()
)
returns table (
  id                 uuid,
  title              text,
  venue_id           uuid,
  starts_at          timestamptz,
  ends_at            timestamptz,
  price_min          numeric,
  price_max          numeric,
  is_free            boolean,
  ticket_url         text,
  age_min            int,
  status             public.event_status,
  cover_key          text,
  image_url          text,
  popularity         int,
  genre_slugs        text[],
  artist_ids         uuid[],
  venue_slug         text,
  venue_name         text,
  venue_area         text,
  venue_city         text,
  venue_address      text,
  venue_lat          double precision,
  venue_lng          double precision,
  venue_status       public.venue_status,
  venue_adult_only   boolean,
  venue_genre_slugs  text[],
  venue_hours        text,
  venue_cover_key    text,
  venue_placeholder  boolean,
  distance_km        double precision,
  total_count        int
)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  with params as (
    select
      public.fold_text(nullif(btrim(p_query), '')) as q,
      nullif(p_area, '')                           as area,
      case when p_genre_slugs is null or cardinality(p_genre_slugs) = 0
           then null else p_genre_slugs end         as genres,
      coalesce(p_sort, 'date')                     as sort,
      greatest(coalesce(p_limit, 20), 0)           as lim,
      greatest(coalesce(p_offset, 0), 0)           as off
  ),
  candidates as (
    select
      e.*,
      v.slug        as v_slug,
      v.name        as v_name,
      v.area        as v_area,
      v.city        as v_city,
      v.address     as v_address,
      v.lat         as v_lat,
      v.lng         as v_lng,
      v.status      as v_status,
      v.adult_only  as v_adult_only,
      v.genre_slugs as v_genre_slugs,
      v.hours       as v_hours,
      v.cover_key   as v_cover_key,
      v.placeholder as v_placeholder,
      public.haversine_km(p_lat, p_lng, v.lat, v.lng) as dist
    from public.events e
    join public.venues v on v.id = e.venue_id
    cross join params p
    where e.status = 'published'
      and v.status <> 'closed'
      and e.starts_at >= coalesce(p_date_from, p_now)
      and (p_date_to is null or e.starts_at <= p_date_to)
      and (p.area is null or lower(v.area) = lower(p.area))
      and (p_artist_id is null or exists (
            select 1 from public.event_artists ea
            where ea.event_id = e.id and ea.artist_id = p_artist_id))
      and (p.genres is null or exists (
            select 1 from public.event_genres eg
            where eg.event_id = e.id and eg.genre_slug = any (p.genres)))
      and (p_price_max is null
           or e.is_free
           or (p_price_max > 0 and e.price_min is not null and e.price_min <= p_price_max))
      and (p.q is null
           or strpos(public.fold_text(e.title), p.q) > 0
           or strpos(public.fold_text(v.name), p.q) > 0
           or exists (
                select 1 from public.event_artists ea
                join public.artists a on a.id = ea.artist_id
                where ea.event_id = e.id and strpos(public.fold_text(a.name), p.q) > 0))
  ),
  filtered as (
    select c.*, round(c.dist::numeric, 3)::double precision as dist_r
    from candidates c
    where p_radius_km is null or c.dist <= p_radius_km
  ),
  ranked as (
    select
      f.*,
      count(*) over () as total,
      row_number() over (
        order by
          case when p.sort = 'distance' then f.dist_r end asc nulls last,
          case when p.sort = 'price' then
            case when f.is_free then 0::numeric else f.price_min end
          end asc nulls last,
          case when p.sort = 'popularity' then f.popularity end desc nulls last,
          f.starts_at asc,
          f.id asc
      ) as rn
    from filtered f
    cross join params p
  )
  select
    r.id, r.title, r.venue_id, r.starts_at, r.ends_at,
    r.price_min, r.price_max, r.is_free, r.ticket_url, r.age_min,
    r.status, r.cover_key, r.image_url, r.popularity,
    coalesce((
      select array_agg(eg.genre_slug order by g.sort_order, eg.genre_slug)
      from public.event_genres eg
      join public.genres g on g.slug = eg.genre_slug
      where eg.event_id = r.id), '{}'::text[]) as genre_slugs,
    coalesce((
      select array_agg(ea.artist_id order by ea.billing_order, ea.artist_id)
      from public.event_artists ea
      where ea.event_id = r.id), '{}'::uuid[]) as artist_ids,
    r.v_slug, r.v_name, r.v_area, r.v_city, r.v_address, r.v_lat, r.v_lng,
    r.v_status, r.v_adult_only, r.v_genre_slugs, r.v_hours, r.v_cover_key, r.v_placeholder,
    r.dist_r as distance_km,
    r.total::int as total_count
  from ranked r
  cross join params p
  where r.rn > p.off and r.rn <= p.off + p.lim
  order by r.rn
$$;

comment on function public.search_events is
  'Event search for the app. Semantics mirrored by app/src/data/seedRepo.ts; fixtures in supabase/tests/fixtures.';

revoke execute on function public.search_events(
  double precision, double precision, double precision, text[], numeric,
  timestamptz, timestamptz, uuid, text, text, text, int, int, timestamptz) from public;
grant execute on function public.search_events(
  double precision, double precision, double precision, text[], numeric,
  timestamptz, timestamptz, uuid, text, text, text, int, int, timestamptz)
  to anon, authenticated, service_role;
