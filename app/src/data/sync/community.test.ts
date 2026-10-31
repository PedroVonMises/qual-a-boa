import { fakeClient, flush, type Handler } from './fakeClient';
import {
  mapCommentRow,
  mapThreadRow,
  pullComments,
  pullThreads,
  pushCommentVote,
  pushCommunityReport,
  pushHandle,
  type CommentFeedRow,
  type ThreadFeedRow,
} from './community';

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

  it('treats a missing handle as anonymous even if the flag says otherwise', () => {
    expect(mapThreadRow({ ...threadRow, handle: null }).author).toEqual({ anonymous: true });
  });

  it('keeps the viewer\'s own vote out of the stored count (the UI adds it back)', () => {
    expect(mapCommentRow({ ...commentRow, voted: true }).helpfulCount).toBe(17);
    expect(mapCommentRow({ ...commentRow, voted: true }).voted).toBe(true);
    expect(mapCommentRow(commentRow).helpfulCount).toBe(18);
  });
});

describe('community pull', () => {
  it('reads threads_feed newest first', async () => {
    const calls = use(() => ({ data: [threadRow] }));
    const list = await pullThreads();
    expect(list.map((t) => t.id)).toEqual([TH]);
    expect(calls[0]).toMatchObject({ table: 'threads_feed', op: 'select' });
  });

  it('reads comments_feed for one thread, and nothing for a local id', async () => {
    const calls = use(() => ({ data: [commentRow] }));
    expect((await pullComments(TH)).map((c) => c.id)).toEqual([CM]);
    expect(calls[0]).toMatchObject({ table: 'comments_feed', filters: [['thread_id', 'eq', TH]] });
    expect(await pullComments('th-local')).toEqual([]);
    expect(calls).toHaveLength(1);
  });

  it('propagates server errors so the query shows its error state', async () => {
    use(() => ({ error: { code: '42501', message: 'rls' } }));
    await expect(pullThreads()).rejects.toMatchObject({ code: '42501' });
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
