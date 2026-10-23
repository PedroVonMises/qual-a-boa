-- 0001_schema.sql
-- Core catalog (genres, venues, artists, events + join tables) and per-user tables
-- (profiles, favorites). Postgres 17. Requires the Supabase `auth` schema
-- (auth.users, auth.uid()); the local PGlite harness creates a stub of it.

create type public.venue_status as enum ('open', 'closed', 'unverified');
create type public.event_status as enum ('published', 'cancelled', 'draft');
create type public.favorite_kind as enum ('event', 'venue', 'artist');

-- Genres ---------------------------------------------------------------------
create table public.genres (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  label       text not null,
  sort_order  int  not null default 0
);

-- Venues ---------------------------------------------------------------------
create table public.venues (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name         text not null,
  area         text not null,
  city         text not null default 'Vitória',
  address      text,
  lat          double precision not null check (lat between -90 and 90),
  lng          double precision not null check (lng between -180 and 180),
  status       public.venue_status not null default 'unverified',
  adult_only   boolean not null default false,
  genre_slugs  text[] not null default '{}',
  hours        text,
  cover_key    text not null default 'generic'
               check (cover_key in ('bolt','selva','gordinho','pub426','caipora','fluente','mare','generic')),
  placeholder  boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index venues_lat_lng_idx on public.venues (lat, lng);
create index venues_area_lower_idx on public.venues (lower(area));

-- Artists --------------------------------------------------------------------
create table public.artists (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name         text not null,
  genre_slugs  text[] not null default '{}',
  photo_url    text,
  created_at   timestamptz not null default now()
);

-- Events ---------------------------------------------------------------------
create table public.events (
  id          uuid primary key default gen_random_uuid(),
  venue_id    uuid not null references public.venues (id) on delete cascade,
  title       text not null,
  starts_at   timestamptz not null,
  ends_at     timestamptz,
  price_min   numeric(10,2) check (price_min >= 0),
  price_max   numeric(10,2) check (price_max >= 0),
  is_free     boolean not null default false,
  ticket_url  text,
  age_min     int not null default 18 check (age_min between 0 and 21),
  status      public.event_status not null default 'draft',
  cover_key   text not null default 'generic'
              check (cover_key in ('bolt','selva','gordinho','pub426','caipora','fluente','mare','generic')),
  popularity  int not null default 0 check (popularity between 0 and 100),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint events_ends_after_start check (ends_at is null or ends_at > starts_at),
  constraint events_price_range check (price_min is null or price_max is null or price_max >= price_min)
);
create index events_starts_at_idx on public.events (starts_at);
create index events_venue_id_idx on public.events (venue_id);
create index events_published_starts_idx on public.events (starts_at) where status = 'published';

create table public.event_genres (
  event_id    uuid not null references public.events (id) on delete cascade,
  genre_slug  text not null references public.genres (slug) on update cascade on delete cascade,
  primary key (event_id, genre_slug)
);
create index event_genres_genre_idx on public.event_genres (genre_slug);

create table public.event_artists (
  event_id       uuid not null references public.events (id) on delete cascade,
  artist_id      uuid not null references public.artists (id) on delete cascade,
  billing_order  int  not null default 0,
  primary key (event_id, artist_id)
);
create index event_artists_artist_idx on public.event_artists (artist_id);
create index event_artists_order_idx on public.event_artists (event_id, billing_order);

-- Per-user -------------------------------------------------------------------
create table public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  display_name  text,
  created_at    timestamptz not null default now()
);

create table public.favorites (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind        public.favorite_kind not null,
  ref_id      uuid not null,
  created_at  timestamptz not null default now(),
  constraint favorites_unique unique (user_id, kind, ref_id)
);
