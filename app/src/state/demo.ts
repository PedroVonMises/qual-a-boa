import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { defaultAlerts, defaultChannels, useFollows } from './follows';
import { useCheckins } from './checkins';
import { useFavorites } from './favorites';
import { useFilters } from './filters';
import { useLive } from './live';
import { useLocation } from './location';
import { safeMerge } from './safeMerge';
import { useReviews } from './reviews';
import { useSession } from './session';
import { useSupport } from './support';

import type { EventChange, EventFollow, LiveReport, Review, SupportTicket } from '@/domain/engage';
import type { EventItem, SeedDataset } from '@/domain/types';

/**
 * Demo mode: fills the persisted user stores with example data so the whole UI can be exercised without a backend.
 * It only calls setState on local stores (never the sync-pushing actions), so nothing reaches a remote.
 * All ids created here are NOT uuids (prefix "demo-"), so remote sync skips them.
 */
interface DemoStore {
  loaded: boolean;
  setLoaded: (v: boolean) => void;
}

export const useDemoLoaded = create<DemoStore>()(
  persist(
    (set) => ({ loaded: false, setLoaded: (loaded) => set({ loaded }) }),
    {
      name: 'qab.demo',
      merge: (persisted, current) => safeMerge(persisted, current),
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ loaded: s.loaded }),
    },
  ),
);

const H = 3_600_000;
const iso = (ms: number) => new Date(ms).toISOString();

function defaultDataset(): SeedDataset {
  return require('@/data/seed.json') as SeedDataset;
}

/** Stable internal marker: the seed gives the Casa Maré demo events a ticket URL containing this token (never rely on titles). */
export const DEMO_EVENT_MARKER = '/casa-mare-demo-';
const isDemoEvent = (e: EventItem) => !!e.ticketUrl && e.ticketUrl.includes(DEMO_EVENT_MARKER);
const ACK = 'Recebemos seu chamado. Respondemos por aqui assim que possível.';

/** Fills the user stores. Idempotent: running it twice yields the same state. */
export function loadDemoData(dataset: SeedDataset = defaultDataset(), nowMs: number = Date.now()): void {
  const { events, venues } = dataset;
  const casaMare = venues.find((v) => v.slug === 'casa-mare');
  const demo = events.filter(isDemoEvent);
  const inProgress = demo.find((e) => Date.parse(e.startsAt) <= nowMs && Date.parse(e.endsAt ?? e.startsAt) > nowMs);
  const upcomingDemo = demo.find((e) => Date.parse(e.startsAt) > nowMs);
  const regular = events.filter((e) => !isDemoEvent(e) && e.status === 'published');
  const future = regular.filter((e) => Date.parse(e.startsAt) > nowMs).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const past = regular.filter((e) => Date.parse(e.endsAt ?? e.startsAt) < nowMs).sort((a, b) => b.startsAt.localeCompare(a.startsAt));

  // Session + location
  useSession.setState({ ageConfirmed: true, onboardingDone: true });
  useLocation.getState().resetLocation();

  // Favorites
  useFavorites.setState({
    eventIds: [...new Set([inProgress?.id, upcomingDemo?.id, ...future.slice(0, 3).map((e) => e.id)].filter((x): x is string => !!x))],
    venueIds: [casaMare?.slug ?? 'casa-mare', 'bolt'],
    artistSlugs: ['dj-maresia', 'lia-sol'],
  });

  // Follows (3 events, one with ticket, some alerts off)
  const followIds = [inProgress?.id, upcomingDemo?.id, future[0]?.id].filter((x): x is string => !!x);
  const follows: Record<string, EventFollow> = {};
  followIds.forEach((id, i) => {
    follows[id] = {
      eventId: id,
      followedAt: iso(nowMs - (i + 1) * 24 * H),
      hasTicket: i === 0,
      alerts: { ...defaultAlerts(), price: i !== 2, lastTickets: i === 0 },
      channels: { ...defaultChannels(), email: i === 1 },
    };
  });
  const changes: EventChange[] = followIds[2]
    ? [{ id: 'demo-chg-1', eventId: followIds[2], kind: 'lineup', text: 'Nova atração confirmada no line-up', at: iso(nowMs - 3 * H), read: false }]
    : [];
  useFollows.setState({ follows, changes });

  // Check-in at the event in progress
  useCheckins.setState({ checkins: inProgress ? [{ eventId: inProgress.id, at: iso(nowMs - 30 * 60_000) }] : [], unsynced: [] });

  // Local live reports on the event in progress
  const reports: LiveReport[] = inProgress
    ? [
        { id: 'demo-rep-1', eventId: inProgress.id, at: iso(nowMs - 40 * 60_000), queue: 'short', crowd: 'busy', priceAtDoor: 40 },
        { id: 'demo-rep-2', eventId: inProgress.id, at: iso(nowMs - 20 * 60_000), queue: 'none', crowd: 'busy', music: 'good' },
        { id: 'demo-rep-3', eventId: inProgress.id, at: iso(nowMs - 5 * 60_000), crowd: 'full', music: 'peak' },
      ]
    : [];
  useLive.setState({ reports, unsynced: [] });

  // Own reviews: one pending ('Em análise'), one published
  const mine: Review[] = [];
  if (past[0]) {
    mine.push({
      id: 'demo-rv-1', eventId: past[0].id, rating: 4, topics: { musica: 5, ambiente: 4, fila: 3 }, tags: [],
      text: 'Som ótimo, fila um pouco longa na entrada.', anonymous: false, attended: true,
      status: 'pending', createdAt: iso(nowMs - 2 * 24 * H), helpfulCount: 0, mine: true,
    });
  }
  if (past[1]) {
    mine.push({
      id: 'demo-rv-2', eventId: past[1].id, rating: 5, topics: { musica: 5, atendimento: 5 }, tags: [],
      text: 'Noite incrível, voltaria fácil.', anonymous: true, attended: false,
      status: 'published', createdAt: iso(nowMs - 9 * 24 * H), helpfulCount: 2, mine: true,
    });
  }
  useReviews.setState({ mine, helpfulIds: [], reportedIds: [], unsynced: [], reportSentIds: [] });

  // Support: one open (automatic ack) and one answered
  const t1At = iso(nowMs - 2 * H);
  const t2At = iso(nowMs - 3 * 24 * H);
  const tickets: SupportTicket[] = [
    {
      id: 'demo-tk-1', topic: 'ingresso', eventId: inProgress?.id,
      description: 'Não recebi meu ingresso por e-mail.', status: 'open', createdAt: t1At,
      messages: [
        { id: 'demo-tk-1-m1', ticketId: 'demo-tk-1', from: 'user', text: 'Não recebi meu ingresso por e-mail.', at: t1At },
        { id: 'demo-tk-1-auto', ticketId: 'demo-tk-1', from: 'support', text: ACK, at: t1At },
      ],
    },
    {
      id: 'demo-tk-2', topic: 'conta', description: 'Como altero meu raio padrão de busca?', status: 'answered', createdAt: t2At,
      messages: [
        { id: 'demo-tk-2-m1', ticketId: 'demo-tk-2', from: 'user', text: 'Como altero meu raio padrão de busca?', at: t2At },
        { id: 'demo-tk-2-auto', ticketId: 'demo-tk-2', from: 'support', text: ACK, at: t2At },
        { id: 'demo-tk-2-m2', ticketId: 'demo-tk-2', from: 'support', text: 'Olá! Em Perfil > Preferências você ajusta o raio padrão com os botões de mais e menos.', at: iso(nowMs - 2 * 24 * H) },
        { id: 'demo-tk-2-m3', ticketId: 'demo-tk-2', from: 'user', text: 'Achei, obrigado!', at: iso(nowMs - 2 * 24 * H + 600_000) },
        { id: 'demo-tk-2-m4', ticketId: 'demo-tk-2', from: 'support', text: 'Por nada! Qualquer dúvida é só chamar.', at: iso(nowMs - 2 * 24 * H + 1_200_000) },
      ],
    },
  ];
  useSupport.setState({ tickets, unsynced: [], remoteIds: {} });

  useDemoLoaded.getState().setLoaded(true);
}

/** Empties every user-data store (favorites, follows, check-ins, reports, reviews, support). Keeps session and location. */
export function clearDemoData(): void {
  useFavorites.setState({ eventIds: [], venueIds: [], artistSlugs: [] });
  useFollows.setState({ follows: {}, changes: [] });
  useCheckins.setState({ checkins: [], unsynced: [] });
  useLive.setState({ reports: [], unsynced: [] });
  useReviews.setState({ mine: [], helpfulIds: [], reportedIds: [], unsynced: [], reportSentIds: [] });
  useSupport.setState({ tickets: [], unsynced: [], remoteIds: {} });
  useDemoLoaded.getState().setLoaded(false);
}

/** Clears everything including session, filters and location, so the age gate and onboarding show again. */
export function resetApp(): void {
  clearDemoData();
  useFilters.getState().reset();
  useLocation.getState().resetLocation();
  useSession.getState().reset();
}
