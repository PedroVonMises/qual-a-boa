// Runs the real SupabaseRepo against a live project with Node's real fetch (jest-expo replaces fetch, so this is
// a node:test script, not a jest test). Skipped unless EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY
// are set; the anon/publishable key is public by design and RLS is the security boundary.
//   EXPO_PUBLIC_SUPABASE_URL=... EXPO_PUBLIC_SUPABASE_ANON_KEY=... npm run test:remote
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { SupabaseRepo } from '../../app/src/data/supabaseRepo';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';
const VITORIA = { lat: -20.2976, lng: -40.2958, label: 'Praia do Canto' };

describe('SupabaseRepo against the live project', { skip: !url || !key }, () => {
  const repo = url && key ? new SupabaseRepo(url, key) : (null as unknown as SupabaseRepo);

  it('lists genres and areas', async () => {
    assert.ok((await repo.listGenres()).length > 0);
    assert.ok((await repo.listAreas()).length > 0);
  });

  // Regression: an explicit p_now null made search_events return nothing.
  it('returns upcoming published events when the caller sets no `now`', async () => {
    const page = await repo.searchEvents({ ...VITORIA, radiusKm: 30, sort: 'date', limit: 5 });
    assert.ok(page.total > 0, 'total');
    assert.ok(page.items.length > 0, 'items');
    for (const { event } of page.items) assert.equal(event.status, 'published');
  });

  it('resolves event, venue and artist detail from search results', async () => {
    const { items } = await repo.searchEvents({ ...VITORIA, radiusKm: 30, sort: 'popularity', limit: 5 });
    const { event, venue } = items[0];
    const detail = await repo.getEvent(event.id, VITORIA);
    assert.equal(detail?.event.id, event.id);
    assert.equal((await repo.getVenue(venue.slug))?.venue.slug, venue.slug);
    const artistId = event.artistIds[0];
    if (artistId) {
      const artist = detail?.lineup.find((a) => a.id === artistId);
      assert.ok(artist, 'artist in event detail');
      assert.equal((await repo.getArtist(artist!.slug))?.artist.id, artistId);
    }
  });

  it('finds artists by name', async () => {
    assert.ok((await repo.searchArtists('dj')).length > 0);
  });
});
