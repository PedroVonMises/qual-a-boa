// Test helper: a hand-written chainable stand-in for the supabase-js query builder.
import type { SupabaseClient } from '@supabase/supabase-js';

export interface Call {
  table: string;
  op: 'select' | 'insert' | 'update' | 'upsert' | 'delete';
  payload?: unknown;
  filters: Array<[string, string, unknown]>;
  selected: boolean;
}
export type Result = { data?: unknown; error?: { code?: string; message: string } | null };
export type Handler = (call: Call) => Result | Promise<Result>;

export function fakeClient(handler: Handler): { client: SupabaseClient; calls: Call[] } {
  const calls: Call[] = [];
  const from = (table: string) => {
    const call: Call = { table, op: 'select', filters: [], selected: false };
    const run = async (): Promise<{ data: unknown; error: unknown }> => {
      calls.push(call);
      const r = await handler(call);
      return { data: r.data ?? null, error: r.error ?? null };
    };
    const b: Record<string, unknown> = {
      select: () => {
        call.selected = true;
        return b;
      },
      insert: (p: unknown) => {
        call.op = 'insert';
        call.payload = p;
        return b;
      },
      upsert: (p: unknown) => {
        call.op = 'upsert';
        call.payload = p;
        return b;
      },
      update: (p: unknown) => {
        call.op = 'update';
        call.payload = p;
        return b;
      },
      delete: () => {
        call.op = 'delete';
        return b;
      },
      eq: (c: string, v: unknown) => (call.filters.push([c, 'eq', v]), b),
      in: (c: string, v: unknown) => (call.filters.push([c, 'in', v]), b),
      order: () => b,
      limit: () => b,
      single: () => run(),
      then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) => run().then(res, rej),
    };
    return b;
  };
  return { client: { from } as unknown as SupabaseClient, calls };
}

export const flush = () => new Promise<void>((r) => setTimeout(r, 0));
