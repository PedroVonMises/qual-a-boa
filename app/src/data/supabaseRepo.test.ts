import type { SupabaseClient } from '@supabase/supabase-js';

import { SupabaseRepo, mapSearchRow } from './supabaseRepo';

// A flat row exactly as the `search_events` RPC returns it (migration 0002).
const row = {
  id: 'e1',
  title: 'Noite do Pagodão',
  venue_id: 'v1',
  starts_at: '2026-10-24T23:00:00+00:00',
  ends_at: null,
  price_min: '30',
  price_max: '30',
  is_free: false,
  ticket_url: 'https://example.com/ingressos/noite',
  age_min: 18,
  status: 'published',
  cover_key: 'mare',
  popularity: 70,
  genre_slugs: ['pagode-samba'],
  artist_ids: ['a1', 'a2'],
  venue_slug: 'casa-mare',
  venue_name: 'Casa Maré',
  venue_area: 'Praia do Canto',
  venue_city: 'Vitória',
  venue_address: null,
  venue_lat: -20.3,
  venue_lng: -40.29,
  venue_status: 'open',
  venue_adult_only: false,
  venue_genre_slugs: ['pagode-samba'],
  venue_hours: null,
  venue_cover_key: 'mare',
  venue_placeholder: true,
  distance_km: 1.234,
  total_count: 3,
};

function fakeClient(rpcRows: unknown[]): SupabaseClient {
  const rpc = jest.fn().mockResolvedValue({ data: rpcRows, error: null });
  return { rpc } as unknown as SupabaseClient;
}

describe('mapSearchRow', () => {
  it('maps the flat RPC row to a SearchItem', () => {
    const item = mapSearchRow(row);
    expect(item.event).toMatchObject({
      id: 'e1',
      venueId: 'v1',
      priceMin: 30,
      isFree: false,
      genreSlugs: ['pagode-samba'],
      artistIds: ['a1', 'a2'],
      coverKey: 'mare',
    });
    expect(item.venue).toMatchObject({ id: 'v1', slug: 'casa-mare', area: 'Praia do Canto', status: 'open', placeholder: true });
    expect(item.distanceKm).toBe(1.234);
  });
});

describe('SupabaseRepo.searchEvents', () => {
  it('passes RPC args and computes the next cursor from total_count', async () => {
    const client = fakeClient([row]);
    const repo = new SupabaseRepo('', '', client);
    const page = await repo.searchEvents({ lat: -20.3, lng: -40.29, radiusKm: 5, genreSlugs: ['funk'], sort: 'date', limit: 1 });
    expect(client.rpc).toHaveBeenCalledWith(
      'search_events',
      expect.objectContaining({ p_radius_km: 5, p_genre_slugs: ['funk'], p_sort: 'date', p_limit: 1, p_offset: 0, p_price_max: null }),
    );
    expect(page.total).toBe(3);
    expect(page.items).toHaveLength(1);
    expect(page.nextCursor).toBe('1');
  });

  it('omits p_now unless the caller sets it (a null would defeat the SQL default and match nothing)', async () => {
    const client = fakeClient([row]);
    const repo = new SupabaseRepo('', '', client);
    await repo.searchEvents({ lat: -20.3, lng: -40.29, radiusKm: 5, sort: 'date' });
    const sent = (client.rpc as jest.Mock).mock.calls[0][1] as Record<string, unknown>;
    expect(sent).not.toHaveProperty('p_now');
    await repo.searchEvents({ lat: -20.3, lng: -40.29, radiusKm: 5, sort: 'date', now: '2026-10-28T12:00:00.000Z' });
    expect((client.rpc as jest.Mock).mock.calls[1][1]).toMatchObject({ p_now: '2026-10-28T12:00:00.000Z' });
  });

  it('re-queries the total when a page past the end is empty', async () => {
    const rpc = jest
      .fn()
      .mockResolvedValueOnce({ data: [], error: null })
      .mockResolvedValueOnce({ data: [row], error: null });
    const repo = new SupabaseRepo('', '', { rpc } as unknown as SupabaseClient);
    const page = await repo.searchEvents({ lat: 0, lng: 0, radiusKm: 5, sort: 'date', limit: 20, cursor: '40' });
    expect(page.items).toHaveLength(0);
    expect(page.total).toBe(3);
    expect(page.nextCursor).toBeNull();
    expect(rpc).toHaveBeenCalledTimes(2);
  });
});

describe('SupabaseRepo.searchArtists', () => {
  it('searches through the accent-folding RPC and skips blank queries', async () => {
    const rpc = jest.fn().mockResolvedValue({ data: [{ id: 'a1', slug: 'mare', name: 'Maré', genre_slugs: [] }], error: null });
    const repo = new SupabaseRepo('', '', { rpc } as unknown as SupabaseClient);
    expect((await repo.searchArtists('  mare ', 5)).map((a) => a.name)).toEqual(['Maré']);
    expect(rpc).toHaveBeenCalledWith('search_artists', { p_query: 'mare', p_limit: 5 });
    expect(await repo.searchArtists('   ')).toEqual([]);
    expect(rpc).toHaveBeenCalledTimes(1);
  });
});

describe('SupabaseRepo tags', () => {
  it('sends p_tags only when tags are set', async () => {
    const client = fakeClient([row]);
    const repo = new SupabaseRepo('', '', client);
    await repo.searchEvents({ lat: -20.3, lng: -40.29, radiusKm: 5, sort: 'date', tags: ['acessivel'] });
    expect((client.rpc as jest.Mock).mock.calls[0][1]).toMatchObject({ p_tags: ['acessivel'] });
    await repo.searchEvents({ lat: -20.3, lng: -40.29, radiusKm: 5, sort: 'date' });
    const sent = (client.rpc as jest.Mock).mock.calls[1][1] as Record<string, unknown>;
    expect('p_tags' in sent).toBe(false);
  });

  it('maps access_tags on the RPC row to event.accessTags', () => {
    const item = mapSearchRow({ ...row, access_tags: ['acessivel', 'vegano'] });
    expect(item.event.accessTags).toEqual(['acessivel', 'vegano']);
  });
});
