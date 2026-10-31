import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Pressable, Text } from 'react-native';

import { fakeClient, flush, type Handler } from './fakeClient';
import {
  mapCommentRow,
  mapThreadRow,
  pullComments,
  pullThread,
  pullThreadsPage,
  refreshFirstPage,
  pushCommentVote,
  pushCommunityReport,
  pushHandle,
  threadsQueryKey,
  useThreadsInfinite,
  type CommentFeedRow,
  type ThreadFeedRow,
} from './community';

import { COMMUNITY_PAGE_SIZE, encodeKeyset, type ThreadQuery } from '@/domain/community';
import { flushCommunity, useCommunity } from '@/state/community';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

let mockClient: unknown = null;
let mockRemote = true;
jest.mock('../supabaseClient', () => ({
  isRemote: () => mockRemote,
  getSupabase: () => (mockRemote ? mockClient : null),
  ensureUserId: async () => (mockRemote ? 'user-1' : null),
}));

const EV = '11111111-1111-4111-8111-111111111111';
const TH = '22222222-2222-4222-8222-222222222222';
const CM = '33333333-3333-4333-8333-333333333333';
const CM2 = '44444444-4444-4444-8444-444444444444';

const threadRow: ThreadFeedRow = {
  id: TH,
  event_id: EV,
  venue_id: null,
  event_name: 'Noite do Pagodão',
  venue_slug: 'casa-mare',
  kind: 'vale_a_pena',
  title: 'Vale pagar o camarote?',
  body: null,
  anonymous: false,
  handle: 'marina_vix',
  avatar_hue: 340,
  status: 'published',
  comment_count: 4,
  created_at: '2026-10-30T20:00:00Z',
  mine: false,
  archived: false,
  top_comment_id: CM,
  top_comment_body: 'A pista resolve.',
  top_comment_votes: 18,
  uf: 'ES',
};

const commentRow: CommentFeedRow = {
  id: CM,
  thread_id: TH,
  parent_id: null,
  body: 'A pista resolve.',
  anonymous: false,
  handle: 'rafa.praia',
  avatar_hue: 20,
  status: 'published',
  helpful_count: 18,
  created_at: '2026-10-30T21:00:00Z',
  mine: false,
  voted: false,
};

function use(handler: Handler) {
  const f = fakeClient(handler);
  mockClient = f.client;
  return f.calls;
}

/** Server stand-in: accepts everything and answers inserts with fixed ids. */
const accept: Handler = (c) => {
  if (c.table === 'threads' && c.op === 'insert') return { data: { id: TH } };
  if (c.table === 'comments' && c.op === 'insert') return { data: { id: c.payload && (c.payload as { parent_id: string | null }).parent_id ? CM2 : CM } };
  return {};
};

const settle = async () => {
  for (let i = 0; i < 12; i++) await flush();
};

const reset = () =>
  useCommunity.setState({
    handle: undefined,
    threads: [],
    comments: [],
    votedIds: [],
    reportedIds: [],
    reportSentIds: [],
    aliases: {},
    handleTaken: false,
    tick: 0,
  });

beforeEach(() => {
  mockRemote = true;
  reset();
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
});
afterEach(() => jest.restoreAllMocks());

describe('community mapping', () => {
  it('maps a named thread with its pinned reply', () => {
    expect(mapThreadRow(threadRow)).toMatchObject({
      id: TH,
      eventId: EV,
      venueSlug: 'casa-mare',
      eventName: 'Noite do Pagodão',
      author: { anonymous: false, handle: 'marina_vix', avatarHue: 340 },
      replies: 4,
      archived: false,
      top: { body: 'A pista resolve.', votes: 18 },
    });
  });

  it('masks an anonymous thread and omits top when there is no pin', () => {
    const t = mapThreadRow({ ...threadRow, anonymous: true, handle: null, avatar_hue: null, top_comment_id: null, top_comment_body: null, top_comment_votes: null });
    expect(t.author).toEqual({ anonymous: true });
    expect(t.top).toBeUndefined();
  });

  it("carries the thread's state", () => {
    expect(mapThreadRow(threadRow).uf).toBe('ES');
    expect(mapThreadRow({ ...threadRow, uf: 'SP' }).uf).toBe('SP');
  });

  it('treats a missing handle as anonymous even if the flag says otherwise', () => {
    expect(mapThreadRow({ ...threadRow, handle: null }).author).toEqual({ anonymous: true });
  });

  it('keeps the viewer\'s own vote out of the stored count (the UI adds it back)', () => {
    expect(mapCommentRow({ ...commentRow, voted: true }).helpfulCount).toBe(17);
    expect(mapCommentRow({ ...commentRow, voted: true }).voted).toBe(true);
    expect(mapCommentRow(commentRow).helpfulCount).toBe(18);
  });
});

/** Row `i` of a fixed newest-first sequence: strictly decreasing created_at, unique ids. */
const rowAt = (i: number): ThreadFeedRow => ({
  ...threadRow,
  id: `00000000-0000-4000-8000-${String(i + 1000).padStart(12, '0')}`,
  title: `T${i}`,
  created_at: new Date(Date.parse('2026-10-30T20:00:00Z') - i * 60_000).toISOString(),
  top_comment_id: null,
  top_comment_body: null,
  top_comment_votes: null,
});
const rows = (from: number, count: number) => Array.from({ length: count }, (_, k) => rowAt(from + k));
const FEED: ThreadQuery = { scope: 'all', sort: 'recent' };
const N = COMMUNITY_PAGE_SIZE;

describe('community pull', () => {
  it('asks for one extra row, newest first with an id tiebreak, and hides archived threads from the feed', async () => {
    const calls = use(() => ({ data: [threadRow] }));
    const page = await pullThreadsPage(FEED);
    expect(page.items.map((t) => t.id)).toEqual([TH]);
    expect(calls[0]).toMatchObject({ table: 'threads_feed', op: 'select', limit: N + 1 });
    expect(calls[0].orders).toEqual([
      ['created_at', { ascending: false }],
      ['id', { ascending: false }],
    ]);
    expect(calls[0].filters).toContainEqual(['archived', 'eq', false]);
  });

  it('returns a full page plus a keyset cursor when a further row exists', async () => {
    use(() => ({ data: rows(0, N + 1) }));
    const page = await pullThreadsPage(FEED);
    expect(page.items).toHaveLength(N);
    expect(page.nextCursor).toBe(encodeKeyset({ createdAt: rowAt(N - 1).created_at, id: rowAt(N - 1).id }));
  });

  it('has no cursor on the last page (exactly a page, or less)', async () => {
    use(() => ({ data: rows(0, N) }));
    expect((await pullThreadsPage(FEED)).nextCursor).toBeNull();
    use(() => ({ data: rows(0, 3) }));
    expect((await pullThreadsPage(FEED)).nextCursor).toBeNull();
    use(() => ({ data: [] }));
    expect(await pullThreadsPage(FEED)).toEqual({ items: [], nextCursor: null });
  });

  it("filters the feed by state on the server, but not an event's own page", async () => {
    const calls = use(() => ({ data: [] }));
    await pullThreadsPage({ ...FEED, uf: 'ES' });
    expect(calls[0].filters).toContainEqual(['uf', 'eq', 'ES']);

    await pullThreadsPage({ ...FEED, eventId: EV, includeArchived: true });
    expect(calls[1].filters.some((f) => f[0] === 'uf')).toBe(false);
  });

  it('turns the cursor into a keyset filter, so rows posted meanwhile cannot duplicate or skip', async () => {
    const calls = use(() => ({ data: rows(N, 5) }));
    const cursor = encodeKeyset({ createdAt: '2026-10-30T19:40:00.000Z', id: 'abc' });
    await pullThreadsPage(FEED, cursor);
    expect(calls[0].filters).toContainEqual(['', 'or', 'created_at.lt.2026-10-30T19:40:00.000Z,and(created_at.eq.2026-10-30T19:40:00.000Z,id.lt.abc)']);
  });

  it('applies the filters on the server', async () => {
    const calls = use(() => ({ data: [] }));
    await pullThreadsPage({ ...FEED, kind: 'grupo', eventId: EV, includeArchived: true });
    expect(calls[0].filters).toEqual(
      expect.arrayContaining([
        ['kind', 'eq', 'grupo'],
        ['event_id', 'eq', EV],
      ]),
    );
    expect(calls[0].filters).not.toContainEqual(['archived', 'eq', false]);

    await pullThreadsPage({ ...FEED, scope: 'tonight' });
    expect(calls[1].filters).toContainEqual(['kind', 'eq', 'agora']);

    await pullThreadsPage({ ...FEED, scope: 'following', followedEventIds: [EV, 'seed-id'] });
    expect(calls[2].filters).toContainEqual(['event_id', 'in', [EV]]);
  });

  it('makes no request for "Seguindo" without follows, or for an event that is not a server id', async () => {
    const calls = use(() => ({ data: [threadRow] }));
    expect(await pullThreadsPage({ ...FEED, scope: 'following', followedEventIds: [] })).toEqual({ items: [], nextCursor: null });
    expect(await pullThreadsPage({ ...FEED, scope: 'following', followedEventIds: ['seed-id'] })).toEqual({ items: [], nextCursor: null });
    expect(await pullThreadsPage({ ...FEED, eventId: 'evt-001' })).toEqual({ items: [], nextCursor: null });
    expect(calls).toHaveLength(0);
  });

  it('pages the helpful sort by offset over the pinned reply votes', async () => {
    const calls = use(() => ({ data: rows(0, N + 1) }));
    const q: ThreadQuery = { ...FEED, sort: 'helpful', eventId: EV, kind: 'vale_a_pena', includeArchived: true };
    const first = await pullThreadsPage(q);
    expect(first.nextCursor).toBe(String(N));
    expect(calls[0].orders.map((o) => o[0])).toEqual(['top_comment_votes', 'created_at', 'id']);
    expect(calls[0].orders[0][1]).toEqual({ ascending: false, nullsFirst: false });
    expect(calls[0].range).toEqual([0, N]);

    await pullThreadsPage(q, first.nextCursor);
    expect(calls[1].range).toEqual([N, 2 * N]);
  });

  it('reads one thread by id, and nothing for a local id', async () => {
    const calls = use(() => ({ data: [threadRow] }));
    expect((await pullThread(TH))?.id).toBe(TH);
    expect(calls[0].filters).toContainEqual(['id', 'eq', TH]);
    use(() => ({ data: [] }));
    await expect(pullThread(TH)).resolves.toBeNull();
    expect(await pullThread('th-local')).toBeNull();
  });

  it('reads comments_feed for one thread, and nothing for a local id', async () => {
    const calls = use(() => ({ data: [commentRow] }));
    expect((await pullComments(TH)).map((c) => c.id)).toEqual([CM]);
    expect(calls[0]).toMatchObject({ table: 'comments_feed', filters: [['thread_id', 'eq', TH]] });
    expect(await pullComments('th-local')).toEqual([]);
    expect(calls).toHaveLength(1);
  });

  it('propagates server errors so the screen can show its error state', async () => {
    use(() => ({ error: { code: '42501', message: 'rls' } }));
    await expect(pullThreadsPage(FEED)).rejects.toMatchObject({ code: '42501' });
  });
});

describe('handle', () => {
  it('upserts the profile row', async () => {
    const calls = use(() => ({}));
    await expect(pushHandle({ handle: 'marina_vix', avatarHue: 340 })).resolves.toBe('ok');
    expect(calls[0]).toMatchObject({ table: 'profiles', op: 'upsert' });
    expect(calls[0].payload).toEqual({ id: 'user-1', handle: 'marina_vix', avatar_hue: 340 });
  });

  it('reports a taken handle and any other failure', async () => {
    use(() => ({ error: { code: '23505', message: 'profiles_handle_key' } }));
    await expect(pushHandle({ handle: 'x_y', avatarHue: 1 })).resolves.toBe('taken');
    use(() => ({ error: { code: '42501', message: 'rls' } }));
    await expect(pushHandle({ handle: 'x_y', avatarHue: 1 })).resolves.toBe('failed');
  });

  it('claimHandle refuses a taken handle and does not store it', async () => {
    use(() => ({ error: { code: '23505', message: 'dup' } }));
    await expect(useCommunity.getState().claimHandle('@Marina_Vix')).resolves.toMatch(/já está em uso/);
    expect(useCommunity.getState().handle).toBeUndefined();
  });

  it('claimHandle stores it when the server accepts, and also when offline', async () => {
    use(() => ({}));
    await expect(useCommunity.getState().claimHandle('marina_vix')).resolves.toBeUndefined();
    expect(useCommunity.getState().handle).toBe('marina_vix');

    reset();
    mockRemote = false;
    await expect(useCommunity.getState().claimHandle('marina_vix')).resolves.toBeUndefined();
    expect(useCommunity.getState().handle).toBe('marina_vix');
  });

  it('claimHandle validates before calling the server', async () => {
    const calls = use(() => ({}));
    await expect(useCommunity.getState().claimHandle('ab')).resolves.toMatch(/3 a 20/);
    expect(calls).toHaveLength(0);
  });
});

describe('community push (flush)', () => {
  it('posts a named thread: claims the handle, inserts, swaps the id, bumps tick', async () => {
    const calls = use(accept);
    useCommunity.getState().setHandle('marina_vix');
    const r = useCommunity.getState().createThread({
      eventId: EV, eventName: 'Noite do Pagodão', kind: 'vale_a_pena', title: 'Vale?', anonymous: false,
    });
    expect(typeof r).toBe('object');
    await settle();
    expect(calls.map((c) => [c.table, c.op])).toEqual([['profiles', 'upsert'], ['threads', 'insert']]);
    expect(calls[1].payload).toMatchObject({ event_id: EV, user_id: 'user-1', kind: 'vale_a_pena', title: 'Vale?', anonymous: false });
    expect(useCommunity.getState().threads[0].id).toBe(TH);
    expect(useCommunity.getState().tick).toBe(1);
  });

  it('an anonymous thread never touches the profile', async () => {
    const calls = use(accept);
    useCommunity.getState().createThread({ eventId: EV, eventName: 'X', kind: 'agora', title: 'Fila?', anonymous: true });
    await settle();
    expect(calls.map((c) => [c.table, c.op])).toEqual([['threads', 'insert']]);
    expect(calls[0].payload).toMatchObject({ anonymous: true });
  });

  it('a comment written on a not-yet-synced thread waits, then follows it with the new thread id', async () => {
    const calls = use(accept);
    useCommunity.getState().setHandle('marina_vix');
    const t = useCommunity.getState().createThread({ eventId: EV, eventName: 'X', kind: 'grupo', title: 'Mesa?', anonymous: false });
    if (typeof t === 'string') throw new Error(t);
    useCommunity.getState().addComment({ threadId: t.id, body: 'Topo!', anonymous: true });
    await settle();
    const order = calls.filter((c) => c.op === 'insert').map((c) => c.table);
    expect(order).toEqual(['threads', 'comments']);
    expect(calls.find((c) => c.table === 'comments')!.payload).toMatchObject({ thread_id: TH, parent_id: null, body: 'Topo!', anonymous: true });
    const c = useCommunity.getState().comments[0];
    expect(c.threadId).toBe(TH);
    expect(c.id).toBe(CM);
  });

  it('a reply waits for its parent and is then pushed with the parent\'s server id', async () => {
    const calls = use(accept);
    useCommunity.getState().createThread({ eventId: EV, eventName: 'X', kind: 'grupo', title: 'Mesa?', anonymous: true });
    await settle();
    const threadId = useCommunity.getState().threads[0].id;
    expect(threadId).toBe(TH);

    // Offline when posting: both stay local.
    mockRemote = false;
    const parent = useCommunity.getState().addComment({ threadId, body: 'Primeiro', anonymous: true });
    if (typeof parent === 'string') throw new Error(parent);
    useCommunity.getState().addComment({ threadId, parentId: parent.id, body: 'Resposta', anonymous: true });
    expect(calls.filter((c) => c.table === 'comments')).toHaveLength(0);

    mockRemote = true;
    await flushCommunity();
    await settle();
    const inserts = calls.filter((c) => c.table === 'comments').map((c) => c.payload as { body: string; parent_id: string | null });
    expect(inserts.map((p) => p.body)).toEqual(['Primeiro', 'Resposta']);
    expect(inserts[0].parent_id).toBeNull();
    expect(inserts[1].parent_id).toBe(CM);
    expect(useCommunity.getState().comments.every((c) => /^[0-9a-f-]{36}$/.test(c.id))).toBe(true);
  });

  it('a rejected thread stays on this device, its comments are not pushed, and nothing retries in a loop', async () => {
    const calls = use((c) => (c.table === 'threads' ? { error: { code: '42501', message: 'rls' } } : {}));
    const t = useCommunity.getState().createThread({ eventId: EV, eventName: 'X', kind: 'grupo', title: 'Mesa?', anonymous: true });
    if (typeof t === 'string') throw new Error(t);
    useCommunity.getState().addComment({ threadId: t.id, body: 'Oi', anonymous: true });
    await settle();
    expect(calls.filter((c) => c.table === 'threads')).toHaveLength(1);
    expect(calls.filter((c) => c.table === 'comments')).toHaveLength(0);
    expect(useCommunity.getState().threads[0].id).toBe(t.id);
    expect(useCommunity.getState().tick).toBe(0);
  });

  it('claims the handle once per run, however many named posts are waiting', async () => {
    const calls = use(accept);
    useCommunity.getState().setHandle('marina_vix');
    const t = useCommunity.getState().createThread({ eventId: EV, eventName: 'X', kind: 'grupo', title: 'Mesa?', anonymous: false });
    if (typeof t === 'string') throw new Error(t);
    useCommunity.getState().addComment({ threadId: t.id, body: 'Um', anonymous: false });
    useCommunity.getState().addComment({ threadId: t.id, body: 'Dois', anonymous: false });
    await settle();
    expect(calls.filter((c) => c.table === 'profiles')).toHaveLength(1);
    expect(calls.filter((c) => c.op === 'insert').map((c) => c.table)).toEqual(['threads', 'comments', 'comments']);
  });

  it('a handle chosen offline that turns out to be taken is dropped; anonymous posts still go out', async () => {
    const calls = use((c) =>
      c.table === 'profiles' ? { error: { code: '23505', message: 'profiles_handle_key' } } : accept(c),
    );
    useCommunity.getState().setHandle('maria');
    useCommunity.getState().createThread({ eventId: EV, eventName: 'X', kind: 'grupo', title: 'Nomeado', anonymous: false });
    useCommunity.getState().createThread({ eventId: EV, eventName: 'X', kind: 'grupo', title: 'Anonimo', anonymous: true });
    await settle();
    const st = useCommunity.getState();
    expect(st.handle).toBeUndefined();
    expect(st.handleTaken).toBe(true);
    expect(calls.filter((c) => c.table === 'threads').map((c) => (c.payload as { title: string }).title)).toEqual(['Anonimo']);
    expect(st.threads.find((t) => t.title === 'Nomeado')!.id).not.toBe(TH);

    // Picking a new handle clears the warning.
    expect(st.setHandle('maria_vix')).toBeUndefined();
    expect(useCommunity.getState().handleTaken).toBe(false);
  });

  it('a named post without any handle stays local and never reaches the server', async () => {
    const calls = use(accept);
    useCommunity.setState({
      threads: [
        {
          id: 'th-old',
          eventId: EV,
          eventName: 'X',
          kind: 'grupo',
          title: 'Mesa?',
          author: { anonymous: false, handle: 'x_y' },
          createdAt: '2026-10-30T10:00:00Z',
          commentCount: 0,
          helpfulCount: 0,
          mine: true,
        },
      ],
    });
    await flushCommunity();
    expect(calls).toHaveLength(0);
  });

  it('records an alias from the local thread id to the server id', async () => {
    use(accept);
    const t = useCommunity.getState().createThread({ eventId: EV, eventName: 'X', kind: 'grupo', title: 'Mesa?', anonymous: true });
    if (typeof t === 'string') throw new Error(t);
    await settle();
    expect(useCommunity.getState().aliases[t.id]).toBe(TH);
  });

  it('seed-data event ids never reach the server', async () => {
    const calls = use(accept);
    useCommunity.getState().createThread({ eventId: 'evt-001', eventName: 'X', kind: 'grupo', title: 'Mesa?', anonymous: true });
    await settle();
    expect(calls).toHaveLength(0);
  });

  it('does nothing when the backend is off', async () => {
    mockRemote = false;
    const calls = use(accept);
    useCommunity.getState().createThread({ eventId: EV, eventName: 'X', kind: 'grupo', title: 'Mesa?', anonymous: true });
    await settle();
    expect(calls).toHaveLength(0);
  });
});

describe('votes and reports', () => {
  it('helpful inserts and removes comment_votes for server ids only', async () => {
    const calls = use(() => ({}));
    useCommunity.getState().toggleHelpful(CM);
    useCommunity.getState().toggleHelpful(CM);
    useCommunity.getState().toggleHelpful('demo-cm-1');
    await settle();
    expect(calls.map((c) => [c.table, c.op])).toEqual([['comment_votes', 'insert'], ['comment_votes', 'delete']]);
    expect(calls[0].payload).toEqual({ comment_id: CM, user_id: 'user-1' });
    expect(useCommunity.getState().votedIds).toEqual(['demo-cm-1']);
  });

  it('an already-recorded vote counts as success', async () => {
    use(() => ({ error: { code: '23505', message: 'dup' } }));
    await expect(pushCommentVote(CM, true)).resolves.toBe(true);
    use(() => ({ error: { code: '42501', message: 'rls' } }));
    await expect(pushCommentVote(CM, true)).resolves.toBe(false);
  });

  it('adoptVotes adds server-confirmed votes and never removes local ones', () => {
    useCommunity.setState({ votedIds: ['local'] });
    useCommunity.getState().adoptVotes([CM, 'local']);
    expect(useCommunity.getState().votedIds).toEqual(['local', CM]);
  });

  it('Denunciar is "sent" only after the server accepted it', async () => {
    use(() => ({}));
    useCommunity.getState().report(CM, 'comment');
    expect(useCommunity.getState().reportedIds).toEqual([CM]);
    expect(useCommunity.getState().reportSentIds).toEqual([]);
    await settle();
    expect(useCommunity.getState().reportSentIds).toEqual([CM]);

    use(() => ({ error: { code: '42501', message: 'rls' } }));
    useCommunity.getState().report(CM2, 'comment');
    await settle();
    expect(useCommunity.getState().reportedIds).toContain(CM2);
    expect(useCommunity.getState().reportSentIds).not.toContain(CM2);
  });

  it('reports a thread or a comment with exactly one target column', async () => {
    const calls = use(() => ({}));
    await pushCommunityReport({ threadId: TH });
    await pushCommunityReport({ commentId: CM }, 'spam');
    expect(calls[0].payload).toEqual({ user_id: 'user-1', thread_id: TH, comment_id: null, reason: 'Denunciado pelo usuário' });
    expect(calls[1].payload).toEqual({ user_id: 'user-1', thread_id: null, comment_id: CM, reason: 'spam' });
  });
});

describe('remote queries', () => {
  // One client per test (a new one per render would drop the cache); gcTime 0 so no timer outlives the test.
  const makeClient = () => new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });

  function Probe({ q }: { q: ThreadQuery }) {
    const inf = useThreadsInfinite(q);
    const titles = (inf.data?.pages ?? []).flatMap((p) => p.items.map((t) => t.title));
    return (
      <>
        <Text testID="titles">{titles.join(',') || 'vazio'}</Text>
        <Text testID="pages">{`pages:${inf.data?.pages.length ?? 0} next:${String(inf.hasNextPage)}`}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="mais" onPress={() => void inf.fetchNextPage()}>
          <Text>mais</Text>
        </Pressable>
      </>
    );
  }
  const tree = (client: QueryClient, q: ThreadQuery) => (
    <QueryClientProvider client={client}>
      <Probe q={q} />
    </QueryClientProvider>
  );

  it('loads the next page from the cursor and stops when there is none', async () => {
    const calls = use((c) => (c.filters.some((f) => f[1] === 'or') ? { data: rows(N, 5) } : { data: rows(0, N + 1) }));
    await render(tree(makeClient(), FEED));
    await screen.findByText(`pages:1 next:true`);
    await fireEvent.press(screen.getByRole('button', { name: 'mais' }));
    await screen.findByText(`pages:2 next:false`);
    expect(calls).toHaveLength(2);
    expect(screen.getByTestId('titles').props.children.split(',')).toHaveLength(N + 5);
  });

  it('keeps the previous list on screen while a filter change loads', async () => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((r) => (release = r));
    use(async (c) => {
      if (c.filters.some((f) => f[0] === 'kind' && f[2] === 'grupo')) {
        await gate;
        return { data: [{ ...rowAt(50), title: 'grupo-1' }] };
      }
      return { data: [{ ...rowAt(1), title: 'tudo-1' }] };
    });
    const client = makeClient();
    const view = await render(tree(client, FEED));
    await screen.findByText('tudo-1');

    await view.rerender(tree(client, { ...FEED, kind: 'grupo' }));
    expect(screen.getByTestId('titles').props.children).toBe('tudo-1'); // not blank while the new filter loads
    release();
    await screen.findByText('grupo-1');
  });

  describe('refreshFirstPage', () => {
    const prime = async (q: ThreadQuery, client: QueryClient) => {
      const p0 = { items: rows(0, N).map(mapThreadRow), nextCursor: encodeKeyset({ createdAt: rowAt(N - 1).created_at, id: rowAt(N - 1).id }) };
      const p1 = { items: rows(N, 5).map(mapThreadRow), nextCursor: null };
      client.setQueryData(threadsQueryKey(q), { pages: [p0, p1], pageParams: [null, p0.nextCursor] });
    };

    it('replaces page 1 and keeps later pages when its boundary did not move', async () => {
      const client = makeClient();
      await prime(FEED, client);
      use(() => ({ data: [{ ...rowAt(0), title: 'T0-novo' }, ...rows(1, N)] }));
      await refreshFirstPage(client, FEED);
      const data = client.getQueryData<{ pages: { items: { title: string }[] }[] }>(threadsQueryKey(FEED))!;
      expect(data.pages).toHaveLength(2);
      expect(data.pages[0].items[0].title).toBe('T0-novo');
    });

    it('falls back to page 1 when new threads moved the boundary (a kept page 2 would leave a gap)', async () => {
      const client = makeClient();
      await prime(FEED, client);
      use(() => ({ data: rows(-1, N + 1) })); // one newer thread above everything
      await refreshFirstPage(client, FEED);
      const data = client.getQueryData<{ pages: unknown[]; pageParams: unknown[] }>(threadsQueryKey(FEED))!;
      expect(data.pages).toHaveLength(1);
      expect(data.pageParams).toEqual([null]);
    });

    it('reset (pull-to-refresh) always goes back to page 1; an unloaded query is left alone', async () => {
      const client = makeClient();
      await prime(FEED, client);
      use(() => ({ data: rows(0, N + 1) }));
      await refreshFirstPage(client, FEED, { reset: true });
      expect(client.getQueryData<{ pages: unknown[] }>(threadsQueryKey(FEED))!.pages).toHaveLength(1);

      const calls = use(() => ({ data: [] }));
      await refreshFirstPage(client, { ...FEED, kind: 'agora' });
      expect(calls).toHaveLength(0);
    });
  });
});
