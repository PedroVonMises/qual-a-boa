-- 0020_venue_safety_index.sql
-- Índice de segurança da casa (item S2 of docs/MVP-PLANO.md) + the S1 seal on search results.
--
--  * reviews.safety: three short private answers given only in "Foi ao evento" reviews (felt_safe sim|em_parte|nao,
--    harassment nao|sim, staff_helped sim|nao|nao_precisei). Nobody can select the column (not even the author, the
--    app keeps its own copy): it only feeds aggregates.
--  * venue_safety_stats(venue): average of the "Segurança" topic and the share who felt safe, counting only PUBLISHED
--    reviews marked attended with a check-in that still exists (B5 made check-ins proximity-checked), of events that
--    started in the last 6 months. Each figure is null below 5 reviews (k-anonymity), so no single answer shows.
--    JS mirror: app/src/domain/safetyIndex.ts.
--  * search_events also returns venue_safety_protocol so result cards can show the seal.

create function public.valid_review_safety(s jsonb) returns boolean
language sql immutable parallel safe as $$
  select jsonb_typeof(s) = 'object'
     and not exists (
       select 1 from jsonb_each(s) kv
       where jsonb_typeof(kv.value) <> 'string'
          or not case kv.key
                   when 'felt_safe'    then kv.value #>> '{}' in ('sim', 'em_parte', 'nao')
                   when 'harassment'   then kv.value #>> '{}' in ('nao', 'sim')
                   when 'staff_helped' then kv.value #>> '{}' in ('sim', 'nao', 'nao_precisei')
                   else false
                 end)
$$;

alter table public.reviews
  add column safety jsonb not null default '{}'
    constraint reviews_safety_valid check (public.valid_review_safety(safety));
-- Answers only make sense from someone who was there.
alter table public.reviews
  add constraint reviews_safety_needs_attended check (safety = '{}'::jsonb or attended);

grant insert (safety), update (safety) on public.reviews to authenticated;

create function public.venue_safety_stats(p_venue_id uuid, p_now timestamptz default now())
returns table (
  sample_size     int,
  safety_avg      numeric,
  felt_safe_n     int,
  felt_safe_share numeric
)
language sql stable security definer set search_path = public as $$
  with base as (
    select r.topics, r.safety
    from public.reviews r
    join public.events e on e.id = r.event_id
    where e.venue_id = p_venue_id
      and r.status = 'published'
      and r.attended
      and exists (select 1 from public.checkins c where c.user_id = r.user_id and c.event_id = r.event_id)
      and e.starts_at > p_now - interval '6 months'
      and e.starts_at <= p_now
  ), idx as (
    select count(*)::int n, avg((topics ->> 'seguranca')::int) a from base where topics ? 'seguranca'
  ), felt as (
    select count(*)::int n, avg(case when safety ->> 'felt_safe' = 'sim' then 1 else 0 end) s
    from base where safety ? 'felt_safe'
  )
  select idx.n,
         case when idx.n >= 5 then round(idx.a, 1) end,
         felt.n,
         case when felt.n >= 5 then round(felt.s, 2) end
  from idx, felt
$$;

revoke execute on function public.venue_safety_stats(uuid, timestamptz) from public;
grant execute on function public.venue_safety_stats(uuid, timestamptz) to anon, authenticated, service_role;

-- search_events: same as 0009 plus venue_safety_protocol --------------------------------------------------------------
drop function public.search_events(
  double precision, double precision, double precision, text[], numeric,
  timestamptz, timestamptz, uuid, text, text, text, int, int, timestamptz, text[]);

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
  p_now         timestamptz default now(),
  p_tags        text[]      default null
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
  access_tags        text[],
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
  venue_safety_protocol text,
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
      case when p_tags is null or cardinality(p_tags) = 0
           then null else p_tags end                as tags,
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
      v.access_tags as v_access_tags,
      v.safety_protocol as v_safety_protocol,
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
      and (p.tags is null or (e.access_tags || v.access_tags) @> p.tags)
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
      select array_agg(t order by array_position(
        array['acessivel', 'lgbtqia', 'pet-friendly', 'vegano']::text[], t))
      from (select distinct unnest(r.access_tags || r.v_access_tags) as t) u), '{}'::text[]) as access_tags,
    coalesce((
      select array_agg(ea.artist_id order by ea.billing_order, ea.artist_id)
      from public.event_artists ea
      where ea.event_id = r.id), '{}'::uuid[]) as artist_ids,
    r.v_slug, r.v_name, r.v_area, r.v_city, r.v_address, r.v_lat, r.v_lng,
    r.v_status, r.v_adult_only, r.v_genre_slugs, r.v_hours, r.v_cover_key, r.v_placeholder,
    r.v_safety_protocol,
    r.dist_r as distance_km,
    r.total::int as total_count
  from ranked r
  cross join params p
  where r.rn > p.off and r.rn <= p.off + p.lim
  order by r.rn
$$;

comment on function public.search_events is
  'Event search for the app. Semantics mirrored by app/src/data/seedRepo.ts; fixtures in supabase/tests/fixtures. p_tags: AND over venue + event access_tags. venue_safety_protocol: selo Não é Não (0019).';

revoke execute on function public.search_events(
  double precision, double precision, double precision, text[], numeric,
  timestamptz, timestamptz, uuid, text, text, text, int, int, timestamptz, text[]) from public;
grant execute on function public.search_events(
  double precision, double precision, double precision, text[], numeric,
  timestamptz, timestamptz, uuid, text, text, text, int, int, timestamptz, text[])
  to anon, authenticated, service_role;
