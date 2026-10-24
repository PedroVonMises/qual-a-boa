import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  DEFAULT_LOCATION,
  type Artist,
  type ArtistDetail,
  type CoverKey,
  type EventDetail,
  type EventItem,
  type GeoPoint,
  type Genre,
  type PastArtist,
  type SearchItem,
  type SearchPage,
  type SearchParams,
  type Venue,
  type VenueDetail,
} from '@/domain/types';
import { haversineKm } from '@/domain/geo';
import type { Repo } from './repo';

export class RepoError extends Error {
  readonly code: 'network' | 'query' | 'config';
  constructor(code: RepoError['code'], message: string, readonly cause?: unknown) {
    super(message);
    this.name = 'RepoError';
    this.code = code;
  }
}

 
type Row = Record<string, any>;

const pick = <T>(row: Row, snake: string, camel: string): T => (row[snake] !== undefined ? row[snake] : row[camel]) as T;

export function mapGenre(r: Row): Genre {
  return { id: r.id, slug: r.slug, label: r.label };
}

export function mapArtist(r: Row): Artist {
  return {
    id: r.id,
    slug: r.slug,
    name: r.name,
    genreSlugs: pick<string[] | null>(r, 'genre_slugs', 'genreSlugs') ?? [],
    photoUrl: pick<string | null>(r, 'photo_url', 'photoUrl') ?? undefined,
  };
}

export function mapVenue(r: Row): Venue {
  return {
    id: r.id,
    slug: r.slug,
    name: r.name,
    area: r.area,
    city: r.city,
    address: r.address ?? undefined,
    lat: Number(r.lat),
    lng: Number(r.lng),
    status: r.status,
    adultOnly: pick<boolean>(r, 'adult_only', 'adultOnly') ?? false,
    genreSlugs: pick<string[] | null>(r, 'genre_slugs', 'genreSlugs') ?? [],
    hours: r.hours ?? undefined,
    coverKey: (pick<string | null>(r, 'cover_key', 'coverKey') ?? 'generic') as CoverKey,
    placeholder: r.placeholder ?? false,
  };
}

const num = (v: unknown): number | null => (v == null ? null : Number(v));

export function mapEvent(r: Row): EventItem {
  const genreSlugs: string[] =
    pick<string[] | undefined>(r, 'genre_slugs', 'genreSlugs') ??
    (r.event_genres ?? []).map((g: Row) => g.genres?.slug ?? g.genre_slug).filter(Boolean);
  const artistIds: string[] =
    pick<string[] | undefined>(r, 'artist_ids', 'artistIds') ??
    [...(r.event_artists ?? [])]
      .sort((a: Row, b: Row) => (a.billing_order ?? 0) - (b.billing_order ?? 0))
      .map((a: Row) => a.artist_id);
  return {
    id: r.id,
    title: r.title,
    venueId: pick<string>(r, 'venue_id', 'venueId'),
    startsAt: new Date(pick<string>(r, 'starts_at', 'startsAt')).toISOString(),
    endsAt: pick<string | null>(r, 'ends_at', 'endsAt') ? new Date(pick<string>(r, 'ends_at', 'endsAt')).toISOString() : undefined,
    priceMin: num(pick(r, 'price_min', 'priceMin')),
    priceMax: num(pick(r, 'price_max', 'priceMax')),
    isFree: pick<boolean>(r, 'is_free', 'isFree') ?? false,
    ticketUrl: pick<string | null>(r, 'ticket_url', 'ticketUrl') ?? undefined,
    ageMin: pick<number | null>(r, 'age_min', 'ageMin') ?? 18,
    genreSlugs,
    artistIds,
    status: r.status,
    coverKey: (pick<string | null>(r, 'cover_key', 'coverKey') ?? 'generic') as CoverKey,
    popularity: Number(r.popularity ?? 0),
  };
}

const EVENT_SELECT = '*, event_genres(genres(slug)), event_artists(artist_id, billing_order)';

/** One flat row of the `search_events` RPC (see supabase/migrations/0002_search_events.sql). */
export function mapSearchRow(r: Row): SearchItem {
  return {
    event: mapEvent(r),
    venue: mapVenue({
      id: r.venue_id,
      slug: r.venue_slug,
      name: r.venue_name,
      area: r.venue_area,
      city: r.venue_city,
      address: r.venue_address,
      lat: r.venue_lat,
      lng: r.venue_lng,
      status: r.venue_status,
      adult_only: r.venue_adult_only,
      genre_slugs: r.venue_genre_slugs,
      hours: r.venue_hours,
      cover_key: r.venue_cover_key,
      placeholder: r.venue_placeholder,
    }),
    distanceKm: Number(r.distance_km),
  };
}

export class SupabaseRepo implements Repo {
  private readonly client: SupabaseClient;

  constructor(url: string, anonKey: string, client?: SupabaseClient) {
    if (!client && (!url || !anonKey)) {
      throw new RepoError('config', 'Supabase não configurado: defina EXPO_PUBLIC_SUPABASE_URL e EXPO_PUBLIC_SUPABASE_ANON_KEY.');
    }
    this.client = client ?? createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  }

  private fail(error: { message: string }, what: string): never {
    throw new RepoError('query', `Falha ao carregar ${what}: ${error.message}`, error);
  }

  private async wrap<T>(what: string, run: () => PromiseLike<{ data: T | null; error: { message: string } | null }>): Promise<T> {
    let res;
    try {
      res = await run();
    } catch (e) {
      throw new RepoError('network', `Sem conexão ao carregar ${what}.`, e);
    }
    if (res.error) this.fail(res.error, what);
    return res.data as T;
  }

  async listGenres(): Promise<Genre[]> {
    const rows = await this.wrap<Row[]>('gêneros', () => this.client.from('genres').select('*').order('label'));
    return rows.map(mapGenre);
  }

  async listAreas(): Promise<string[]> {
    const rows = await this.wrap<Row[]>('bairros', () => this.client.from('venues').select('area').neq('status', 'closed'));
    return [...new Set(rows.map((r) => r.area as string))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }

  async searchEvents(params: SearchParams): Promise<SearchPage> {
    const limit = params.limit ?? 20;
    const parsed = Number.parseInt(params.cursor ?? '0', 10);
    const offset = Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
    const rows = await this.wrap<Row[]>('eventos', () =>
      this.client.rpc('search_events', {
        p_lat: params.lat,
        p_lng: params.lng,
        p_radius_km: params.radiusKm,
        p_genre_slugs: params.genreSlugs?.length ? params.genreSlugs : null,
        p_price_max: params.priceMax ?? null,
        p_date_from: params.dateFrom ?? null,
        p_date_to: params.dateTo ?? null,
        p_artist_id: params.artistId ?? null,
        p_area: params.area ?? null,
        p_query: params.query?.trim() || null,
        p_sort: params.sort,
        p_limit: limit,
        p_offset: offset,
        p_now: params.now ?? null,
      }),
    );
    // Flat columns per row: event fields, venue_* fields, distance_km, total_count.
    const list = rows ?? [];
    const items: SearchItem[] = list.map(mapSearchRow);
    let total = list.length ? Number(list[0].total_count) : 0;
    if (!list.length && offset > 0) {
      // search_events returns no rows (hence no total_count) for a page past the end: re-query page 0.
      total = (await this.searchEvents({ ...params, cursor: null, limit: 1 })).total;
    }
    const next = offset + limit;
    return { items, total, nextCursor: next < total ? String(next) : null };
  }

  async getEvent(id: string, from?: GeoPoint): Promise<EventDetail | null> {
    const row = await this.wrap<Row | null>('evento', () =>
      this.client.from('events').select(EVENT_SELECT).eq('id', id).neq('status', 'draft').maybeSingle(),
    );
    if (!row) return null;
    const event = mapEvent(row);
    const venueRow = await this.wrap<Row | null>('local', () => this.client.from('venues').select('*').eq('id', event.venueId).maybeSingle());
    if (!venueRow) return null;
    const venue = mapVenue(venueRow);
    let lineup: Artist[] = [];
    if (event.artistIds.length) {
      const arts = await this.wrap<Row[]>('line-up', () => this.client.from('artists').select('*').in('id', event.artistIds));
      const byId = new Map(arts.map((a) => [a.id as string, mapArtist(a)]));
      lineup = event.artistIds.map((a) => byId.get(a)).filter((a): a is Artist => !!a);
    }
    return {
      event,
      venue,
      lineup,
      distanceKm: from ? haversineKm(from.lat, from.lng, venue.lat, venue.lng) : null,
    };
  }

  async getVenue(slug: string): Promise<VenueDetail | null> {
    const venueRow = await this.wrap<Row | null>('local', () => this.client.from('venues').select('*').eq('slug', slug).maybeSingle());
    if (!venueRow) return null;
    const venue = mapVenue(venueRow);
    const [upcomingRows, past] = await Promise.all([
      this.wrap<Row[]>('próximos eventos', () =>
        this.client
          .from('events')
          .select(EVENT_SELECT)
          .eq('venue_id', venue.id)
          .eq('status', 'published')
          .gte('starts_at', new Date().toISOString())
          .order('starts_at', { ascending: true })
          .order('id', { ascending: true }),
      ),
      this.wrap<Row[]>('artistas anteriores', () => this.client.rpc('venue_past_artists', { p_venue_id: venue.id })),
    ]);
    const pastArtists: PastArtist[] = (past ?? []).map((r) => ({
      artist: mapArtist({
        id: r.artist_id,
        slug: r.artist_slug,
        name: r.artist_name,
        genre_slugs: r.artist_genre_slugs,
        photo_url: r.artist_photo_url,
      }),
      lastPlayedAt: new Date(pick<string>(r, 'last_played_at', 'lastPlayedAt')).toISOString(),
      times: Number(r.times),
    }));
    return { venue, upcoming: upcomingRows.map(mapEvent), pastArtists };
  }

  async getArtist(slug: string, from?: GeoPoint): Promise<ArtistDetail | null> {
    const row = await this.wrap<Row | null>('artista', () => this.client.from('artists').select('*').eq('slug', slug).maybeSingle());
    if (!row) return null;
    const artist = mapArtist(row);
    const origin = from ?? DEFAULT_LOCATION;
    // Two steps instead of an inner-joined embed: filtering on a second event_artists embed would
    // truncate each event's line-up to this artist only.
    const links = await this.wrap<Row[]>('próximos eventos', () =>
      this.client.from('event_artists').select('event_id').eq('artist_id', artist.id),
    );
    const eventIds = [...new Set(links.map((l) => l.event_id as string))];
    const [eventRows, played] = await Promise.all([
      eventIds.length
        ? this.wrap<Row[]>('próximos eventos', () =>
            this.client
              .from('events')
              .select(EVENT_SELECT)
              .in('id', eventIds)
              .eq('status', 'published')
              .gte('starts_at', new Date().toISOString())
              .order('starts_at', { ascending: true })
              .order('id', { ascending: true }),
          )
        : Promise.resolve([] as Row[]),
      this.wrap<Row[]>('locais', () => this.client.rpc('artist_played_at', { p_artist_id: artist.id })),
    ]);
    const events = eventRows.map(mapEvent);
    const venueIds = [...new Set(events.map((e) => e.venueId))];
    const venues = venueIds.length
      ? await this.wrap<Row[]>('locais', () => this.client.from('venues').select('*').in('id', venueIds))
      : [];
    const venueById = new Map(venues.map((v) => [v.id as string, mapVenue(v)]));
    const upcoming: SearchItem[] = [];
    for (const event of events) {
      const venue = venueById.get(event.venueId);
      if (!venue || venue.status === 'closed') continue;
      upcoming.push({ event, venue, distanceKm: haversineKm(origin.lat, origin.lng, venue.lat, venue.lng) });
    }
    // artist_played_at returns venue_* summary columns without coordinates: load full venues by id.
    const playedIds = [...new Set((played ?? []).map((r) => r.venue_id as string))];
    const playedVenues = playedIds.length
      ? await this.wrap<Row[]>('locais', () => this.client.from('venues').select('*').in('id', playedIds))
      : [];
    const playedById = new Map(playedVenues.map((v) => [v.id as string, mapVenue(v)]));
    const playedAt = (played ?? [])
      .map((r) => ({ venue: playedById.get(r.venue_id as string), lastPlayedAt: new Date(r.last_played_at).toISOString() }))
      .filter((p): p is { venue: Venue; lastPlayedAt: string } => !!p.venue);
    return { artist, upcoming, playedAt };
  }

  async searchArtists(query: string, limit = 10): Promise<Artist[]> {
    const q = query.trim().replace(/[%,()]/g, ' ');
    if (!q) return [];
    const rows = await this.wrap<Row[]>('artistas', () =>
      this.client.from('artists').select('*').ilike('name', `%${q.replace(/[\\%_]/g, '\\$&')}%`).order('name').limit(limit),
    );
    return rows.map(mapArtist);
  }
}
