import type { SupabaseClient } from '@supabase/supabase-js';

/** Test double: a chainable PostgREST-like builder that records calls and answers from `respond`. */
export interface Call {
  table: string;
  op: 'select' | 'insert' | 'upsert' | 'delete' | 'rpc';
  payload?: unknown;
  opts?: unknown;
  filters: [string, unknown][];
}
export type Reply = { data?: unknown; error?: { code?: string; message?: string } | null };

export function fakeSupabase(respond: (c: Call) => Reply | undefined = () => ({ data: [], error: null })) {
  const calls: Call[] = [];
  const answer = (c: Call): Reply => ({ data: null, error: null, ...(respond(c) ?? {}) });
  const builder = (call: Call) => {
    const b: Record<string, unknown> = {};
    const chain = (name: string) => (...args: unknown[]) => {
      if (name === 'select' && call.op !== 'select') return b; // insert(...).select('id')
      call.filters.push([name, args]);
      return b;
    };
    for (const m of ['eq', 'in', 'match', 'order', 'limit', 'select', 'single', 'maybeSingle']) b[m] = chain(m);
    b.then = (ok: (v: Reply) => unknown, bad: (e: unknown) => unknown) => Promise.resolve(answer(call)).then(ok, bad);
    return b;
  };
  const start = (table: string, op: Call['op']) => (payload?: unknown, opts?: unknown) => {
    const call: Call = { table, op, payload, opts, filters: [] };
    calls.push(call);
    return builder(call);
  };
  const client = {
    from: (table: string) => ({
      select: start(table, 'select'),
      insert: start(table, 'insert'),
      upsert: start(table, 'upsert'),
      delete: start(table, 'delete'),
    }),
    rpc: (name: string, args: unknown) => {
      const call: Call = { table: name, op: 'rpc', payload: args, filters: [] };
      calls.push(call);
      return Promise.resolve(answer(call));
    },
    auth: {
      getSession: () => Promise.resolve({ data: { session: { user: { id: 'u1' } } } }),
      signInAnonymously: () => Promise.resolve({ data: { user: { id: 'u1' } } }),
    },
  } as unknown as SupabaseClient;
  return { client, calls };
}
