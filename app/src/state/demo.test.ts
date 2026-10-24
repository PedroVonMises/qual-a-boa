import { useCheckins } from './checkins';
import { clearDemoData, loadDemoData, resetApp, useDemoLoaded } from './demo';
import { useFavorites } from './favorites';
import { useFollows } from './follows';
import { useLive } from './live';
import { useReviews } from './reviews';
import { useSession } from './session';
import { useSupport } from './support';

import type { EventItem, SeedDataset } from '@/domain/types';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

const NOW = Date.parse('2026-10-24T15:00:00Z');
const H = 3_600_000;
const uuid = (n: number) => `00000000-0000-3000-8000-${String(n).padStart(12, '0')}`;
const ev = (n: number, title: string, startH: number, endH: number): EventItem => ({
  id: uuid(n), title, venueId: 'v', ticketUrl: title.startsWith('Agora') || title.startsWith('Breve') ? `https://example.com/ingressos/casa-mare-demo-${n}` : undefined, startsAt: new Date(NOW + startH * H).toISOString(), endsAt: new Date(NOW + endH * H).toISOString(),
  priceMin: 10, priceMax: 20, isFree: false, ageMin: 18, genreSlugs: [], artistIds: [], status: 'published', coverKey: 'bolt', popularity: 1,
});
const ds = {
  generatedAt: new Date(NOW).toISOString(), genres: [], artists: [],
  venues: [{ id: 'v', slug: 'casa-mare' }],
  events: [
    ev(1, 'Agora', -1, 4), ev(2, 'Breve', 2, 7), ev(3, 'Passado A', -30, -25), ev(4, 'Passado B', -60, -55),
    ev(5, 'Futuro A', 24, 29), ev(6, 'Futuro B', 48, 53), ev(7, 'Futuro C', 72, 77),
  ],
} as unknown as SeedDataset;

const snapshot = () => JSON.stringify([
  useFavorites.getState().eventIds, useFollows.getState().follows, useCheckins.getState().checkins,
  useLive.getState().reports, useReviews.getState().mine, useSupport.getState().tickets,
]);

describe('demo data', () => {
  it('loads every store with non-uuid ids', () => {
    loadDemoData(ds, NOW);
    expect(useSession.getState()).toMatchObject({ ageConfirmed: true, onboardingDone: true });
    expect(useFavorites.getState().venueIds).toHaveLength(2);
    expect(useFavorites.getState().artistSlugs).toHaveLength(2);
    const follows = useFollows.getState().follows;
    expect(Object.keys(follows)).toEqual(expect.arrayContaining([uuid(1), uuid(2)]));
    expect(Object.keys(follows)).toHaveLength(3);
    expect(Object.values(follows).filter((f) => f.hasTicket)).toHaveLength(1);
    expect(useCheckins.getState().hasCheckedIn(uuid(1))).toBe(true);
    expect(useLive.getState().reports.length).toBeGreaterThanOrEqual(3);
    expect(useReviews.getState().mine.map((r) => r.status).sort()).toEqual(['pending', 'published']);
    const tickets = useSupport.getState().tickets;
    expect(tickets.map((t) => t.status).sort()).toEqual(['answered', 'open']);
    const ids = [
      ...useLive.getState().reports.map((r) => r.id), ...useReviews.getState().mine.map((r) => r.id),
      ...tickets.flatMap((t) => [t.id, ...t.messages.map((m) => m.id)]), ...useFollows.getState().changes.map((c) => c.id),
    ];
    for (const id of ids) expect(id).not.toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-/i);
    expect(useDemoLoaded.getState().loaded).toBe(true);
  });

  it('is idempotent', () => {
    loadDemoData(ds, NOW);
    const a = snapshot();
    loadDemoData(ds, NOW);
    expect(snapshot()).toBe(a);
  });

  it('clearDemoData empties user data but keeps the session', () => {
    loadDemoData(ds, NOW);
    clearDemoData();
    expect(useFavorites.getState().eventIds).toEqual([]);
    expect(Object.keys(useFollows.getState().follows)).toEqual([]);
    expect(useSupport.getState().tickets).toEqual([]);
    expect(useReviews.getState().mine).toEqual([]);
    expect(useDemoLoaded.getState().loaded).toBe(false);
    expect(useSession.getState().ageConfirmed).toBe(true);
  });

  it('resetApp also clears the session', () => {
    loadDemoData(ds, NOW);
    resetApp();
    expect(useSession.getState()).toMatchObject({ ageConfirmed: false, onboardingDone: false });
    expect(useCheckins.getState().checkins).toEqual([]);
  });
});
