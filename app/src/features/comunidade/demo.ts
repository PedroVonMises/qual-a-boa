import type { Comment, Thread } from '@/domain/community';

/**
 * Pilot demonstration threads. Like the demo reviews, they exist ONLY for Casa Maré (slug `casa-mare`, a fictional
 * venue) and read as normal posts. Other venues never get invented conversations: they show an honest empty state.
 */
export const DEMO_VENUE_SLUG = 'casa-mare';

const anon = { anonymous: true } as const;
const user = (handle: string, avatarHue: number) => ({ anonymous: false, handle, avatarHue }) as const;

export const DEMO_THREADS: Thread[] = [
  {
    id: 'demo-th-1',
    venueSlug: DEMO_VENUE_SLUG,
    eventName: 'Casa Maré',
    kind: 'vale_a_pena',
    title: 'Vale pagar o camarote ou a pista já resolve?',
    body: 'Nunca fui nessa casa. Quem foi nas últimas edições pode contar se muda muito?',
    author: user('marina_vix', 340),
    createdAt: '2026-10-30T20:00:00Z',
    commentCount: 4,
    helpfulCount: 0,
  },
  {
    id: 'demo-th-2',
    venueSlug: DEMO_VENUE_SLUG,
    eventName: 'Casa Maré',
    kind: 'grupo',
    title: 'Somos 3, procuramos mais 2 para dividir mesa',
    author: user('lu_jp', 160),
    createdAt: '2026-10-30T22:30:00Z',
    commentCount: 1,
    helpfulCount: 0,
  },
  {
    id: 'demo-th-3',
    venueSlug: DEMO_VENUE_SLUG,
    eventName: 'Casa Maré',
    kind: 'agora',
    title: 'Fila na portaria, quanto tempo?',
    author: anon,
    createdAt: '2026-10-31T01:10:00Z',
    commentCount: 2,
    helpfulCount: 0,
  },
];

export const DEMO_COMMENTS: Comment[] = [
  {
    id: 'demo-cm-1',
    threadId: 'demo-th-1',
    author: user('rafa.praia', 20),
    body: 'Fui semana passada: a pista tem ventilação boa e a visão é igual. O camarote só compensa em grupo de 6 ou mais.',
    createdAt: '2026-10-30T21:00:00Z',
    helpfulCount: 18,
  },
  {
    id: 'demo-cm-2',
    threadId: 'demo-th-1',
    parentId: 'demo-cm-1',
    author: user('lu_jp', 160),
    body: 'Concordo. Chegue antes das 23h para ficar perto do palco.',
    createdAt: '2026-10-30T21:40:00Z',
    helpfulCount: 6,
  },
  {
    id: 'demo-cm-3',
    threadId: 'demo-th-1',
    author: anon,
    body: 'A segurança estava atenta, saí às 3h sem problema.',
    createdAt: '2026-10-30T23:00:00Z',
    helpfulCount: 9,
  },
  {
    id: 'demo-cm-4',
    threadId: 'demo-th-1',
    author: user('bia.vv', 280),
    body: 'Som alto, mas não estoura. Levei protetor e nem precisei.',
    createdAt: '2026-10-31T00:20:00Z',
    helpfulCount: 1,
  },
  {
    id: 'demo-cm-5',
    threadId: 'demo-th-2',
    author: user('rafa.praia', 20),
    body: 'Topo! Chego às 22h pela entrada lateral.',
    createdAt: '2026-10-30T23:10:00Z',
    helpfulCount: 2,
  },
  {
    id: 'demo-cm-6',
    threadId: 'demo-th-3',
    author: user('bia.vv', 280),
    body: 'Uns 15 minutos. A entrada lateral está livre.',
    createdAt: '2026-10-31T01:20:00Z',
    helpfulCount: 7,
  },
  {
    id: 'demo-cm-7',
    threadId: 'demo-th-3',
    author: anon,
    body: 'Confirmo, já entrei.',
    createdAt: '2026-10-31T01:30:00Z',
    helpfulCount: 1,
  },
];
