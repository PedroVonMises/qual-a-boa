import seed from '@/data/seed.json';
import { SeedRepo } from '@/data/seedRepo';
import { proximityFeature, rankItems, scoreItem, timeFeature } from './recommend';
import { EMPTY_PROFILE, type RecoContext, type TasteProfile } from './recommendTypes';
import type { EventItem, SearchItem, SeedDataset, Venue } from './types';

const NOW = Date.parse('2026-10-24T22:00:00.000Z'); // Sat 19h SP
const H = 3600_000;
const venue = (id: string, over: Partial<Venue> = {}): Venue => ({
  id, slug: id, name: id, area: 'Centro', city: 'Vitória', lat: 0, lng: 0, status: 'open', adultOnly: true,
  genreSlugs: [], coverKey: 'generic', placeholder: false, ...over,
});
const item = (id: string, over: Partial<EventItem> = {}, d = 1, v: Venue = venue('v-' + id)): SearchItem => ({
  event: {
    id, title: id, venueId: v.id, startsAt: new Date(NOW + 2 * H).toISOString(), priceMin: 40, priceMax: 40, isFree: false,
    ageMin: 18, genreSlugs: [], artistIds: [], status: 'published', coverKey: 'generic', popularity: 50, ...over,
  },
  venue: v,
  distanceKm: d,
});
const ctx = (profile: TasteProfile = EMPTY_PROFILE): RecoContext => ({ profile, radiusKm: 10 });
const funk: TasteProfile = { ...EMPTY_PROFILE, genreWeights: { funk: 1 }, signals: 5 };
const ids = (xs: { item: SearchItem }[]) => xs.map((s) => s.item.event.id);

describe('recommend', () => {
  it('cold start ranks by time, proximity and popularity', () => {
    const r = rankItems([item('far', {}, 9), item('near', {}, 0.5), item('pop', { popularity: 95 }, 9)], ctx(), NOW);
    expect(ids(r)).toEqual(['near', 'pop', 'far']);
  });

  it('a Funk favorite lifts Funk events', () => {
    const items = [item('a-rock', { genreSlugs: ['rock'] }), item('b-funk', { genreSlugs: ['funk'] })];
    expect(ids(rankItems(items, ctx(), NOW))[0]).toBe('a-rock'); // tie -> id asc
    const r = rankItems(items, ctx(funk), NOW);
    expect(r[0].item.event.id).toBe('b-funk');
    expect(r[0].reasons.map((x) => x.text)).toContain('Você curte Funk');
  });

  it('confidence scales personal terms', () => {
    const it = item('x', { genreSlugs: ['funk'] });
    const cold = scoreItem(it, ctx(), NOW).score;
    const weak = scoreItem(it, ctx({ ...funk, signals: 1 }), NOW).score;
    const strong = scoreItem(it, ctx(funk), NOW).score;
    expect(cold).toBeLessThan(weak);
    expect(weak).toBeLessThan(strong);
  });

  it('in progress beats far-future; ended has no time fit', () => {
    const live = item('live', { startsAt: new Date(NOW - H).toISOString(), endsAt: new Date(NOW + 3 * H).toISOString() });
    const later = item('later', { startsAt: new Date(NOW + 120 * H).toISOString() });
    expect(ids(rankItems([later, live], ctx(), NOW))[0]).toBe('live');
    expect(timeFeature(new Date(NOW - 8 * H).toISOString(), new Date(NOW - 2 * H).toISOString(), NOW)).toBe(0);
    expect(scoreItem(live, ctx(), NOW).reasons[0].text).toBe('Acontecendo agora');
  });

  it('distance decay is monotonic', () => {
    let prev = 2;
    for (const d of [0, 0.5, 1, 3, 6, 10, 25]) {
      const v = proximityFeature(d, 10);
      expect(v).toBeLessThan(prev);
      prev = v;
    }
  });

  it('penalizes unverified venues', () => {
    const a = scoreItem(item('a', {}, 1, venue('va', { status: 'unverified' })), ctx(), NOW).score;
    const b = scoreItem(item('b', {}, 1, venue('vb')), ctx(), NOW).score;
    expect(a).toBeLessThan(b);
  });

  it('diversity: at most 2 in a row from one venue', () => {
    const v = venue('same');
    const same = [1, 2, 3, 4].map((i) => item('s' + i, { popularity: 99 }, 0.2, v));
    const others = [1, 2].map((i) => item('o' + i, { popularity: 10 }, 8));
    const venues = rankItems([...same, ...others], ctx(), NOW).map((s) => s.item.venue.id);
    expect(venues.slice(0, 3)).toEqual(['same', 'same', 'v-o1']);
    expect(venues).toHaveLength(6);
  });

  it('is deterministic: tie-break by start then id, input order irrelevant', () => {
    const e1 = item('b');
    const e2 = item('a');
    expect(ids(rankItems([e1, e2], ctx(), NOW))).toEqual(['a', 'b']);
    expect(ids(rankItems([e2, e1], ctx(), NOW))).toEqual(['a', 'b']);
  });

  describe('seed top-5 snapshot (fixed now)', () => {
    const repo = new SeedRepo(seed as unknown as SeedDataset);
    const top = async (profile: TasteProfile) => {
      const page = await repo.searchEvents({
        lat: -20.2976, lng: -40.2958, radiusKm: 25, sort: 'popularity', limit: 80, now: new Date(NOW).toISOString(),
        dateFrom: new Date(NOW - 5 * H).toISOString(),
      });
      return rankItems(page.items, { profile, radiusKm: 25 }, NOW).slice(0, 5).map((s) => `${s.item.event.title} @ ${s.item.venue.slug}`);
    };
    it('empty profile', async () => {
      expect(await top(EMPTY_PROFILE)).toMatchSnapshot();
    });
    it('Funk profile', async () => {
      expect(await top(funk)).toMatchSnapshot();
    });
  });
});
