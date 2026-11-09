import type { SupabaseClient } from '@supabase/supabase-js';

import {
  cancelEventSubmission,
  claimVenue,
  fetchAccountEvents,
  fetchMyVenueAccounts,
  fetchVenueQuota,
  mapAccountRow,
  openBillingPortal,
  resetCasasDemo,
  startCheckout,
  submissionPayload,
  submitEvent,
  uploadPoster,
} from './casas';
import { setSupabase } from './supabaseClient';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
const mockEnv = { dataSource: 'seed', supabaseUrl: 'http://x', supabaseAnonKey: 'k' };
// Getter: the factory is hoisted above mockEnv, which is only read at call time.
jest.mock('@/lib/env', () => ({ get env() { return mockEnv; } }));

const NOW = Date.parse('2026-11-09T15:00:00Z'); // Monday
const ACC = '00000000-0000-4000-8000-0000000000c1';
const SUB = { title: 'Noite Teste', startsAt: '2026-11-21T23:00:00-03:00', isFree: false, priceMin: 20, priceMax: 40, genreSlugs: ['funk'] };

describe('demo mode (no backend)', () => {
  beforeEach(() => {
    mockEnv.dataSource = 'seed';
    resetCasasDemo(NOW);
  });

  it('starts with Casa Maré verified, subscribed and with two festas this month', async () => {
    const [acc] = await fetchMyVenueAccounts(NOW);
    expect(acc.venue?.name).toBe('Casa Maré');
    expect(acc.status).toBe('verified');
    expect(acc.subscription?.status).toBe('active');
    expect(acc.canSubmit).toBe(true);
    expect(acc.currentMonth).toEqual({ month: '2026-11', used: 2, limit: 4 });
    expect(acc.nextMonth.month).toBe('2026-12');
    expect((await fetchAccountEvents(acc.id)).map((e) => e.status).sort()).toEqual(['pending_review', 'published']);
  });

  it('applies the quota and gives the slot back on withdrawal', async () => {
    const [acc] = await fetchMyVenueAccounts(NOW);
    expect(await submitEvent(acc.id, SUB, NOW)).toMatchObject({ ok: true });
    const fourth = await submitEvent(acc.id, { ...SUB, startsAt: '2026-11-28T23:00:00-03:00' }, NOW);
    expect(fourth.ok).toBe(true);
    const fifth = await submitEvent(acc.id, { ...SUB, startsAt: '2026-11-29T23:00:00-03:00' }, NOW);
    expect(fifth).toEqual({ ok: false, code: 'quota_exceeded', error: 'Você já usou as 4 festas deste mês.' });
    // Night rule: 03:00 on Dec 1 is still November.
    expect(await submitEvent(acc.id, { ...SUB, startsAt: '2026-12-01T03:00:00-03:00' }, NOW)).toMatchObject({ code: 'quota_exceeded' });
    if (!fourth.ok) throw new Error();
    expect(await cancelEventSubmission(fourth.eventId)).toEqual({ ok: true, status: 'rejected' });
    expect((await fetchVenueQuota(acc.id, '2026-11')).used).toBe(3);
    expect(await cancelEventSubmission(fourth.eventId)).toMatchObject({ code: 'not_cancellable' });
  });

  it('blocks dates after the paid period', async () => {
    const [acc] = await fetchMyVenueAccounts(NOW);
    expect(await submitEvent(acc.id, { ...SUB, startsAt: '2027-01-08T23:00:00-03:00' }, NOW)).toMatchObject({ code: 'beyond_paid_period' });
  });

  it('claims a new casa as pending and subscribes it locally', async () => {
    const bad = await claimVenue({ venueId: null, proposed: { name: 'Casa Nova', address: 'Rua A, 1' }, cnpj: '11222333000182', legalName: 'X', contactName: 'Y', whatsapp: '27999990000' });
    expect(bad).toMatchObject({ ok: false, code: 'invalid_cnpj' });
    expect(await claimVenue({ venueId: null, proposed: { name: 'Casa', address: 'Rua' }, cnpj: '11.222.333/0001-81', legalName: 'X', contactName: 'Y', whatsapp: '1' }))
      .toMatchObject({ code: 'cnpj_taken' });
    const res = await claimVenue({ venueId: null, proposed: { name: 'Casa Nova', address: 'Rua A, 1' }, cnpj: '11444777000161', legalName: 'Nova Ltda', contactName: 'Ana', whatsapp: '(27) 99999-0000' });
    if (!res.ok) throw new Error(res.code);
    const created = (await fetchMyVenueAccounts(NOW)).find((a) => a.id === res.accountId)!;
    expect(created.status).toBe('pending');
    expect(created.canSubmit).toBe(false);
    expect(await submitEvent(res.accountId, SUB, NOW)).toMatchObject({ code: 'account_not_verified' });
    expect(await openBillingPortal(res.accountId)).toMatchObject({ code: 'no_customer' });
    expect(await startCheckout(res.accountId, NOW)).toEqual({ ok: true, url: null });
    expect(await startCheckout(res.accountId, NOW)).toMatchObject({ code: 'already_subscribed' });
  });

  it('validates posters before uploading', async () => {
    const [acc] = await fetchMyVenueAccounts(NOW);
    expect(await uploadPoster(acc.id, { uri: 'file://a.gif', mimeType: 'image/gif' })).toMatchObject({ code: 'poster_type' });
    expect(await uploadPoster(acc.id, { uri: 'file://a.jpg', mimeType: 'image/jpeg', size: 6_000_000 })).toMatchObject({ code: 'poster_too_large' });
    const ok = await uploadPoster(acc.id, { uri: 'file://a.jpg', mimeType: 'image/jpeg', size: 1000 });
    expect(ok.ok && ok.path).toMatch(new RegExp(`^${acc.id}/[0-9a-f-]{36}\\.jpg$`));
  });
});

describe('remote mode', () => {
  const calls: [string, unknown][] = [];
  let rpcResult: { data: unknown; error: unknown } = { data: null, error: null };
  let invokeResult: { data: unknown; error: unknown } = { data: null, error: null };

  beforeEach(() => {
    mockEnv.dataSource = 'supabase';
    calls.length = 0;
    const sb = {
      auth: { getSession: async () => ({ data: { session: { user: { id: 'u1' } } } }) },
      rpc: async (name: string, args: unknown) => (calls.push([name, args]), rpcResult),
      functions: { invoke: async (name: string, opts: unknown) => (calls.push([name, opts]), invokeResult) },
      storage: {
        from: (bucket: string) => ({
          upload: async (path: string, _body: unknown, opts: unknown) => (calls.push(['upload', { bucket, path, opts }]), { error: null }),
        }),
      },
    };
    setSupabase(sb as unknown as SupabaseClient);
  });
  afterAll(() => setSupabase(null));

  it('maps my_venue_accounts rows', async () => {
    rpcResult = {
      data: [{
        account_id: ACC, role: 'owner', status: 'verified', cnpj: '11222333000181', legal_name: 'L', contact_name: 'C', whatsapp: '+55',
        review_note: null, created_at: '2026-10-01T00:00:00Z', venue_id: 'v1', venue_slug: 'casa-mare', venue_name: 'Casa Maré', venue_area: 'Praia do Canto',
        proposed_venue: null, plan_code: 'casa_mensal', price_cents: 29900, events_per_month: 4, subscription_status: 'past_due',
        current_period_start: '2026-11-01T00:00:00Z', current_period_end: '2026-12-01T00:00:00Z', cancel_at_period_end: false,
        current_month: '2026-11-01', used_current_month: 3, next_month: '2026-12-01', used_next_month: 0, can_submit: true,
      }],
      error: null,
    };
    const [acc] = await fetchMyVenueAccounts();
    expect(calls[0][0]).toBe('my_venue_accounts');
    expect(acc).toMatchObject({ id: ACC, venue: { name: 'Casa Maré' }, subscription: { status: 'past_due' }, currentMonth: { month: '2026-11', used: 3, limit: 4 }, canSubmit: true });
    const row = (rpcResult.data as Parameters<typeof mapAccountRow>[0][])[0];
    expect(mapAccountRow({ ...row, subscription_status: null }).subscription).toBeNull();
  });

  it('sends snake_case payloads and translates server codes', async () => {
    rpcResult = { data: null, error: { message: 'quota_exceeded', code: 'P0001', hint: 'quota_exceeded' } };
    const res = await submitEvent(ACC, { ...SUB, ticketUrl: ' https://x.com/t ', posterPath: `${ACC}/p.jpg` });
    expect(res).toEqual({ ok: false, code: 'quota_exceeded', error: 'Você já usou as 4 festas deste mês.' });
    expect(calls[0]).toEqual(['submit_event', { p_account: ACC, p_payload: submissionPayload({ ...SUB, ticketUrl: ' https://x.com/t ', posterPath: `${ACC}/p.jpg` }) }]);
    expect(submissionPayload({ ...SUB, isFree: true })).toMatchObject({ is_free: true, price_min: null, price_max: null, age_min: 18 });
    rpcResult = { data: 'ev1', error: null };
    expect(await submitEvent(ACC, SUB)).toEqual({ ok: true, eventId: 'ev1' });
    rpcResult = { data: null, error: { message: 'connection reset' } };
    expect(await submitEvent(ACC, SUB)).toMatchObject({ code: 'network' });
  });

  it('claim_venue sends digits only', async () => {
    rpcResult = { data: ACC, error: null };
    expect(await claimVenue({ venueId: 'v1', proposed: null, cnpj: '11.222.333/0001-81', legalName: 'L', contactName: 'C', whatsapp: '27 99999-0000' }))
      .toEqual({ ok: true, accountId: ACC });
    expect(calls[0]).toEqual(['claim_venue', { p_venue_id: 'v1', p_proposed: null, p_cnpj: '11222333000181', p_legal_name: 'L', p_contact_name: 'C', p_whatsapp: '27 99999-0000' }]);
  });

  it('checkout and portal return the Stripe URL or the function error code', async () => {
    invokeResult = { data: { url: 'https://checkout.stripe.com/c/1' }, error: null };
    expect(await startCheckout(ACC)).toEqual({ ok: true, url: 'https://checkout.stripe.com/c/1' });
    expect(calls[0]).toEqual(['billing-checkout', { method: 'POST', body: { venue_account_id: ACC } }]);
    invokeResult = { data: null, error: { message: 'Edge Function returned a non-2xx status code', context: { json: async () => ({ error: 'already_subscribed' }) } } };
    expect(await startCheckout(ACC)).toMatchObject({ code: 'already_subscribed' });
    invokeResult = { data: { url: 'https://billing.stripe.com/p/1' }, error: null };
    expect(await openBillingPortal(ACC)).toEqual({ ok: true, url: 'https://billing.stripe.com/p/1' });
    invokeResult = { data: { url: 'javascript:alert(1)' }, error: null };
    expect(await openBillingPortal(ACC)).toMatchObject({ ok: false });
  });

  it('uploads posters to the account folder', async () => {
    const realFetch = globalThis.fetch;
    globalThis.fetch = (async () => ({ arrayBuffer: async () => new ArrayBuffer(10) })) as unknown as typeof fetch;
    try {
      const res = await uploadPoster(ACC, { uri: 'file://p.png', mimeType: 'image/png' });
      if (!res.ok) throw new Error(res.code);
      expect(res.path).toMatch(new RegExp(`^${ACC}/[0-9a-f-]{36}\\.png$`));
      expect(calls[0]).toEqual(['upload', { bucket: 'event-posters', path: res.path, opts: { contentType: 'image/png', upsert: false } }]);
    } finally {
      globalThis.fetch = realFetch;
    }
  });
});
