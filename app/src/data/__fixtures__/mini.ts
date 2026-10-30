import type { EventItem, SeedDataset } from '@/domain/types';

/** Fixed "now" for tests: Friday 2026-10-23 12:00 in São Paulo. */
export const MINI_NOW = '2026-10-23T15:00:00.000Z';

const ev = (e: Partial<EventItem> & Pick<EventItem, 'id' | 'title' | 'venueId' | 'startsAt'>): EventItem => ({
  priceMin: null,
  priceMax: null,
  isFree: false,
  ageMin: 18,
  genreSlugs: [],
  artistIds: [],
  status: 'published',
  coverKey: 'generic',
  popularity: 50,
  ...e,
});

export const miniDataset: SeedDataset = {
  generatedAt: '2026-10-01T00:00:00.000Z',
  genres: [
    { id: 'g-funk', slug: 'funk', label: 'Funk' },
    { id: 'g-pagode', slug: 'pagode-samba', label: 'Pagode e samba' },
    { id: 'g-eletro', slug: 'eletronica', label: 'Eletrônica' },
    { id: 'g-rock', slug: 'rock', label: 'Rock' },
  ],
  venues: [
    {
      id: 'v1', slug: 'bolt', name: 'Bolt Club', area: 'Praia do Canto', city: 'Vitória',
      lat: -20.299, lng: -40.295, status: 'open', adultOnly: true, genreSlugs: ['funk', 'eletronica'], accessTags: ['acessivel', 'vegano'],
      coverKey: 'bolt', placeholder: true,
    },
    {
      id: 'v2', slug: 'selva', name: 'Selva Bar', area: 'Jardim da Penha', city: 'Vitória',
      lat: -20.279, lng: -40.288, status: 'open', adultOnly: true, genreSlugs: ['pagode-samba'], accessTags: ['vegano'],
      coverKey: 'selva', placeholder: true,
    },
    {
      id: 'v3', slug: 'caipora', name: 'Caipora', area: 'Vila Velha', city: 'Vila Velha',
      lat: -20.34, lng: -40.29, status: 'unverified', adultOnly: false, genreSlugs: ['rock'],
      coverKey: 'caipora', placeholder: true,
    },
    {
      id: 'v4', slug: 'pub-426', name: 'Pub 426', area: 'Centro', city: 'Vitória',
      lat: -20.319, lng: -40.338, status: 'closed', adultOnly: false, genreSlugs: ['rock'],
      coverKey: 'pub426', placeholder: true,
    },
  ],
  artists: [
    { id: 'a1', slug: 'mc-maré', name: 'MC Maré', genreSlugs: ['funk'] },
    { id: 'a2', slug: 'dj-ágata', name: 'DJ Ágata', genreSlugs: ['eletronica'] },
    { id: 'a3', slug: 'grupo-sol', name: 'Grupo Sol', genreSlugs: ['pagode-samba'] },
    { id: 'a4', slug: 'banda-ferro', name: 'Banda Ferro', genreSlugs: ['rock'] },
    { id: 'a5', slug: 'ana-luz', name: 'Ana Luz', genreSlugs: ['pagode-samba'] },
    { id: 'a6', slug: 'dj-nilo', name: 'DJ Nilo', genreSlugs: ['eletronica', 'funk'] },
  ],
  events: [
    // Upcoming
    ev({ id: 'e01', title: 'Noite do Funk', venueId: 'v1', startsAt: '2026-10-24T02:00:00.000Z', priceMin: 30, priceMax: 60, genreSlugs: ['funk'], artistIds: ['a1', 'a6'], popularity: 90 }),
    ev({ id: 'e02', title: 'Pagode da Selva', venueId: 'v2', startsAt: '2026-10-24T22:00:00.000Z', isFree: true, priceMin: 0, priceMax: 0, genreSlugs: ['pagode-samba'], artistIds: ['a3'], popularity: 70 }),
    ev({ id: 'e03', title: 'Rock na Praia', venueId: 'v3', startsAt: '2026-10-25T01:00:00.000Z', priceMin: 20, priceMax: 20, genreSlugs: ['rock'], artistIds: ['a4'], popularity: 40 }),
    ev({ id: 'e04', title: 'Techno Sessions', venueId: 'v1', startsAt: '2026-10-25T03:00:00.000Z', priceMin: 50, priceMax: 120, genreSlugs: ['eletronica'], artistIds: ['a2', 'a6'], popularity: 80 }),
    ev({ id: 'e05', title: 'Roda de Samba', venueId: 'v2', startsAt: '2026-10-30T20:00:00.000Z', priceMin: 15, priceMax: 25, genreSlugs: ['pagode-samba'], artistIds: ['a5', 'a3'], popularity: 60 }),
    ev({ id: 'e06', title: 'Festa sem Preço Definido', venueId: 'v1', startsAt: '2026-10-31T02:00:00.000Z', genreSlugs: ['funk', 'eletronica'], artistIds: ['a1'], popularity: 60 }),
    ev({ id: 'e07', title: 'Noite do Pub', venueId: 'v4', startsAt: '2026-10-24T23:00:00.000Z', priceMin: 10, priceMax: 10, genreSlugs: ['rock'], artistIds: ['a4'], popularity: 95 }),
    ev({ id: 'e08', title: 'Evento Cancelado', venueId: 'v1', startsAt: '2026-10-26T02:00:00.000Z', priceMin: 10, priceMax: 10, genreSlugs: ['funk'], status: 'cancelled', artistIds: ['a1'] }),
    ev({ id: 'e09', title: 'Rascunho', venueId: 'v2', startsAt: '2026-10-27T02:00:00.000Z', status: 'draft', genreSlugs: ['pagode-samba'] }),
    // Past
    ev({ id: 'e10', title: 'Funk de Ontem', venueId: 'v1', startsAt: '2026-10-10T02:00:00.000Z', priceMin: 30, priceMax: 30, genreSlugs: ['funk'], artistIds: ['a1', 'a2'] }),
    ev({ id: 'e11', title: 'Funk Antigo', venueId: 'v1', startsAt: '2026-09-12T02:00:00.000Z', priceMin: 30, priceMax: 30, genreSlugs: ['funk'], artistIds: ['a1'] }),
    ev({ id: 'e12', title: 'Samba Passado', venueId: 'v2', startsAt: '2026-10-03T22:00:00.000Z', isFree: true, priceMin: 0, priceMax: 0, genreSlugs: ['pagode-samba'], artistIds: ['a3', 'a1'] }),
  ],
};
