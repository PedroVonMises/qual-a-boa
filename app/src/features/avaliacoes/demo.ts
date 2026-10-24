import type { Review } from '@/domain/engage';

/**
 * Pilot demonstration reviews. They exist ONLY for Casa Maré (slug `casa-mare`) and read as normal reviews.
 * Other venues never get invented reviews: they show an honest empty state.
 */
export const DEMO_VENUE_SLUG = 'casa-mare';

const base = { anonymous: true, attended: true, status: 'published' as const, mine: false, tags: [] as string[] };

export const DEMO_REVIEWS: Review[] = [
  {
    ...base,
    id: 'demo-1',
    eventId: 'demo',
    rating: 5,
    topics: { musica: 5, ambiente: 4, seguranca: 5, fila: 4 },
    text: 'Som alto na medida e fila rápida.',
    createdAt: '2026-10-22T14:00:00Z',
    helpfulCount: 12,
  },
  {
    ...base,
    id: 'demo-2',
    eventId: 'demo',
    rating: 4,
    topics: { musica: 5, ambiente: 4, fila: 3, preco: 3 },
    text: 'A pista encheu cedo e a bebida estava um pouco cara.',
    createdAt: '2026-10-19T14:00:00Z',
    helpfulCount: 5,
  },
  {
    ...base,
    id: 'demo-3',
    eventId: 'demo',
    rating: 2,
    topics: { fila: 1, atendimento: 2, seguranca: 4 },
    text: 'A fila na entrada demorou mais de uma hora.',
    createdAt: '2026-10-12T14:00:00Z',
    helpfulCount: 3,
    attended: false,
  },
];
