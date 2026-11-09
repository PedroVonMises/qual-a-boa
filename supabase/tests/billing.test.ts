import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { billingCheckout, type CheckoutDeps } from '../functions/billing-checkout/handler';
import {
  createStripe,
  formEncode,
  mapStripeStatus,
  subscriptionRow,
  type SubscriptionInfo,
  type SubscriptionRow,
} from '../functions/billing-checkout/shared';
import { billingPortal, type PortalDeps } from '../functions/billing-portal/handler';
import { billingWebhook, signStripePayload, verifyStripeSignature, type WebhookDeps } from '../functions/billing-webhook/handler';

const U = '00000000-0000-4000-8000-00000000000a';
const ACC = '00000000-0000-4000-8000-0000000000c1';
const SECRET = 'whsec_test';
const NOW = Date.parse('2026-11-09T12:00:00Z');

interface Call { method: string; url: string; body: string; headers: Record<string, string> }

/** fetch mock: routes by "METHOD /path" to a JSON body (or [status, body]). */
function mockFetch(routes: Record<string, unknown>) {
  const calls: Call[] = [];
  const fetchImpl = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? 'GET';
    const key = `${method} ${new URL(url).pathname}`;
    calls.push({ method, url, body: String(init?.body ?? ''), headers: (init?.headers ?? {}) as Record<string, string> });
    const r = routes[key];
    if (r === undefined) return new Response(JSON.stringify({ error: { message: `no route ${key}` } }), { status: 404 });
    const [status, body] = Array.isArray(r) ? (r as [number, unknown]) : [200, r];
    return new Response(JSON.stringify(body), { status });
  }) as typeof fetch;
  return { calls, stripe: createStripe('sk_test_123', fetchImpl) };
}

const post = (body: unknown, headers: Record<string, string> = { Authorization: 'Bearer tok' }) =>
  new Request('https://x/functions/v1/fn', { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });
const read = async (res: Response) => (await res.json()) as Record<string, unknown>;
const params = (body: string) => Object.fromEntries(new URLSearchParams(body));

describe('shared', () => {
  test('formEncode uses Stripe bracket notation and skips nulls', () => {
    assert.equal(
      decodeURIComponent(formEncode({ a: 'x y', m: { k: 'v' }, l: [{ price: 'p', quantity: 1 }], n: null, u: undefined, b: true })),
      'a=x y&m[k]=v&l[0][price]=p&l[0][quantity]=1&b=true',
    );
  });

  test('maps every Stripe status', () => {
    const cases: Record<string, string> = {
      trialing: 'active', active: 'active', past_due: 'past_due', unpaid: 'past_due', canceled: 'canceled',
      incomplete_expired: 'canceled', incomplete: 'incomplete', paused: 'incomplete', something_new: 'incomplete',
    };
    for (const [stripe, ours] of Object.entries(cases)) assert.equal(mapStripeStatus(stripe), ours, stripe);
  });

  test('subscriptionRow reads the period from the subscription or (new API) its first item', () => {
    const base = { id: 'sub_1', status: 'active', customer: 'cus_1', cancel_at_period_end: true };
    assert.deepEqual(subscriptionRow(ACC, { ...base, current_period_start: 1_700_000_000, current_period_end: 1_702_592_000 }), {
      venue_account_id: ACC, stripe_customer_id: 'cus_1', stripe_subscription_id: 'sub_1', status: 'active',
      current_period_start: '2023-11-14T22:13:20.000Z', current_period_end: '2023-12-14T22:13:20.000Z', cancel_at_period_end: true,
    });
    const r = subscriptionRow(ACC, { ...base, customer: { id: 'cus_2' }, items: { data: [{ current_period_start: 1_700_000_000, current_period_end: 1_702_592_000 }] } });
    assert.equal(r.current_period_end, '2023-12-14T22:13:20.000Z');
    assert.equal(r.stripe_customer_id, 'cus_2');
  });

  test('the Stripe client sends the secret key, form body and idempotency key; errors become exceptions', async () => {
    const { calls, stripe } = mockFetch({ 'POST /v1/customers': { id: 'cus_9' }, 'GET /v1/subscriptions/sub_x': [402, { error: { code: 'card_declined', message: 'no' } }] });
    assert.deepEqual(await stripe.post('/v1/customers', { email: 'a@b.c' }, 'idem-1'), { id: 'cus_9' });
    assert.equal(calls[0].headers.Authorization, 'Bearer sk_test_123');
    assert.equal(calls[0].headers['Content-Type'], 'application/x-www-form-urlencoded');
    assert.equal(calls[0].headers['Idempotency-Key'], 'idem-1');
    assert.equal(calls[0].body, 'email=a%40b.c');
    await assert.rejects(stripe.get('/v1/subscriptions/sub_x'), (e: Error & { status?: number; code?: string }) => e.status === 402 && e.code === 'card_declined');
  });
});

// --- checkout -------------------------------------------------------------------------------------------------

function checkoutDeps(over: Partial<CheckoutDeps> = {}, routes: Record<string, unknown> = {}) {
  const { calls, stripe } = mockFetch({
    'POST /v1/customers': { id: 'cus_new' },
    'POST /v1/checkout/sessions': { id: 'cs_1', url: 'https://checkout.stripe.com/c/cs_1' },
    ...routes,
  });
  const saved: Array<[string, string]> = [];
  const deps: CheckoutDeps = {
    getUser: async () => ({ id: U, email: 'dono@casamare.com' }),
    getOwnedAccount: async (_u, id) => ({ id, status: 'verified', legal_name: 'Casa Maré Ltda' }),
    getSubscription: async () => null,
    saveCustomer: async (a, c) => (saved.push([a, c]), true),
    stripe,
    config: { priceId: 'price_casa', appUrl: 'https://app.qualaboa.com/' },
    ...over,
  };
  return { deps, calls, saved };
}

describe('billing-checkout', () => {
  test('preflight, method and auth', async () => {
    const { deps, calls } = checkoutDeps();
    assert.equal((await billingCheckout(new Request('https://x', { method: 'OPTIONS' }), deps)).status, 204);
    assert.equal((await billingCheckout(new Request('https://x', { method: 'GET' }), deps)).status, 405);
    assert.equal((await billingCheckout(post({ venue_account_id: ACC }, {}), deps)).status, 401);
    assert.equal((await billingCheckout(post({ venue_account_id: ACC }), { ...deps, getUser: async () => null })).status, 401);
    assert.equal((await billingCheckout(post({ venue_account_id: 'nope' }), deps)).status, 400);
    assert.equal(calls.length, 0);
  });

  test('only owners of a non-rejected account, and not twice', async () => {
    let r = checkoutDeps({ getOwnedAccount: async () => null });
    assert.deepEqual(await read(await billingCheckout(post({ venue_account_id: ACC }), r.deps)), { error: 'not_owner' });
    r = checkoutDeps({ getOwnedAccount: async (_u, id) => ({ id, status: 'rejected', legal_name: 'x' }) });
    assert.equal((await billingCheckout(post({ venue_account_id: ACC }), r.deps)).status, 409);
    for (const status of ['active', 'past_due'] as const) {
      r = checkoutDeps({ getSubscription: async (): Promise<SubscriptionInfo> => ({ stripe_customer_id: 'cus_1', status }) });
      const res = await billingCheckout(post({ venue_account_id: ACC }), r.deps);
      assert.equal(res.status, 409);
      assert.deepEqual(await read(res), { error: 'already_subscribed' });
      assert.equal(r.calls.length, 0);
    }
  });

  test('creates the customer once, then a pt-BR subscription Checkout tagged with the account', async () => {
    const { deps, calls, saved } = checkoutDeps({ getOwnedAccount: async (_u, id) => ({ id, status: 'pending', legal_name: 'Casa Maré Ltda' }) });
    const res = await billingCheckout(post({ venue_account_id: ACC }), deps);
    assert.equal(res.status, 200);
    assert.deepEqual(await read(res), { url: 'https://checkout.stripe.com/c/cs_1' });
    assert.deepEqual(calls.map((c) => `${c.method} ${new URL(c.url).pathname}`), ['POST /v1/customers', 'POST /v1/checkout/sessions']);
    assert.deepEqual(params(calls[0].body), { email: 'dono@casamare.com', name: 'Casa Maré Ltda', 'metadata[venue_account_id]': ACC });
    assert.equal(calls[0].headers['Idempotency-Key'], `customer-${ACC}`);
    assert.deepEqual(saved, [[ACC, 'cus_new']]);
    const p = params(calls[1].body);
    assert.equal(p.mode, 'subscription');
    assert.equal(p.customer, 'cus_new');
    assert.equal(p['line_items[0][price]'], 'price_casa');
    assert.equal(p['line_items[0][quantity]'], '1');
    assert.equal(p['metadata[venue_account_id]'], ACC);
    assert.equal(p['subscription_data[metadata][venue_account_id]'], ACC);
    assert.equal(p.client_reference_id, ACC);
    assert.equal(p.locale, 'pt-BR');
    assert.equal(p.success_url, 'https://app.qualaboa.com/casas/assinatura?status=sucesso&session_id={CHECKOUT_SESSION_ID}');
    assert.equal(p.cancel_url, 'https://app.qualaboa.com/casas/assinatura?status=cancelado');
  });

  test('reuses an existing customer (e.g. after a cancellation)', async () => {
    const { deps, calls, saved } = checkoutDeps({ getSubscription: async () => ({ stripe_customer_id: 'cus_old', status: 'canceled' }) });
    assert.equal((await billingCheckout(post({ venue_account_id: ACC }), deps)).status, 200);
    assert.equal(calls.length, 1);
    assert.equal(params(calls[0].body).customer, 'cus_old');
    assert.deepEqual(saved, []);
  });

  test('Stripe failures become a 502 that never leaks the message', async () => {
    const { deps } = checkoutDeps({}, { 'POST /v1/checkout/sessions': [400, { error: { message: 'secret detail' } }] });
    const res = await billingCheckout(post({ venue_account_id: ACC }), deps);
    assert.equal(res.status, 502);
    assert.ok(!JSON.stringify(await read(res)).includes('secret'));
  });
});

// --- portal ---------------------------------------------------------------------------------------------------

describe('billing-portal', () => {
  const portalDeps = (over: Partial<PortalDeps> = {}) => {
    const m = mockFetch({ 'POST /v1/billing_portal/sessions': { url: 'https://billing.stripe.com/p/1' } });
    const deps: PortalDeps = {
      getUser: async () => ({ id: U }),
      getOwnedAccount: async (_u, id) => ({ id, status: 'verified', legal_name: 'x' }),
      getSubscription: async () => ({ stripe_customer_id: 'cus_1', status: 'active' }),
      stripe: m.stripe,
      config: { appUrl: 'https://app.qualaboa.com' },
      ...over,
    };
    return { deps, calls: m.calls };
  };

  test('opens the portal for the account customer', async () => {
    const { deps, calls } = portalDeps();
    const res = await billingPortal(post({ venue_account_id: ACC }), deps);
    assert.deepEqual(await read(res), { url: 'https://billing.stripe.com/p/1' });
    assert.deepEqual(params(calls[0].body), { customer: 'cus_1', return_url: 'https://app.qualaboa.com/casas/assinatura', locale: 'pt-BR' });
  });

  test('refuses non-owners, accounts without a customer and bad requests', async () => {
    assert.equal((await billingPortal(post({ venue_account_id: ACC }, {}), portalDeps().deps)).status, 401);
    assert.equal((await billingPortal(post({}), portalDeps().deps)).status, 400);
    assert.equal((await billingPortal(post({ venue_account_id: ACC }), portalDeps({ getOwnedAccount: async () => null }).deps)).status, 403);
    const r = portalDeps({ getSubscription: async () => null });
    assert.equal((await billingPortal(post({ venue_account_id: ACC }), r.deps)).status, 404);
    assert.equal(r.calls.length, 0);
  });
});

// --- webhook --------------------------------------------------------------------------------------------------

const stripeSub = (over: Record<string, unknown> = {}) => ({
  id: 'sub_1', status: 'active', customer: 'cus_1', cancel_at_period_end: false,
  items: { data: [{ current_period_start: 1_762_689_600, current_period_end: 1_765_281_600 }] },
  metadata: { venue_account_id: ACC }, ...over,
});

function webhookDeps(over: Partial<WebhookDeps> = {}, sub: unknown = stripeSub()) {
  const m = mockFetch({ 'GET /v1/subscriptions/sub_1': sub });
  const events = new Map<string, { processed: boolean }>();
  const rows: SubscriptionRow[] = [];
  const deps: WebhookDeps = {
    secret: SECRET,
    now: () => NOW,
    claimEvent: async (id) => {
      const e = events.get(id);
      if (!e) {
        events.set(id, { processed: false });
        return 'new';
      }
      return e.processed ? 'processed' : 'pending';
    },
    markProcessed: async (id) => void events.set(id, { processed: true }),
    accountFor: async () => null,
    upsertSubscription: async (row) => (rows.push(row), true),
    stripe: m.stripe,
    ...over,
  };
  return { deps, rows, events, calls: m.calls };
}

const evt = (type: string, object: Record<string, unknown>, id = `evt_${type}`) => JSON.stringify({ id, type, data: { object } });

async function deliver(deps: WebhookDeps, raw: string, opts: { t?: number; secret?: string; header?: string } = {}) {
  const header = opts.header ?? (await signStripePayload(raw, opts.secret ?? SECRET, opts.t ?? Math.floor(NOW / 1000)));
  return billingWebhook(new Request('https://x/functions/v1/billing-webhook', { method: 'POST', headers: { 'Stripe-Signature': header }, body: raw }), deps);
}

describe('billing-webhook signature', () => {
  const raw = evt('customer.subscription.updated', stripeSub());

  test('accepts a valid signature (also among several v1 values)', async () => {
    const t = Math.floor(NOW / 1000);
    const good = await signStripePayload(raw, SECRET, t);
    assert.equal(await verifyStripeSignature(good, raw, SECRET, NOW), true);
    assert.equal(await verifyStripeSignature(`t=${t},v1=${'0'.repeat(64)},${good.split(',')[1]},v0=abc`, raw, SECRET, NOW), true);
  });

  for (const [name, opts] of [
    ['a wrong secret', { secret: 'whsec_other' }],
    ['an old timestamp (> 300 s)', { t: Math.floor(NOW / 1000) - 301 }],
    ['a timestamp from the future (> 300 s)', { t: Math.floor(NOW / 1000) + 301 }],
    ['a missing header', { header: '' }],
    ['a malformed header', { header: 'v1=abc' }],
  ] as const) {
    test(`rejects ${name} with 401 and touches nothing`, async () => {
      const { deps, rows, events, calls } = webhookDeps();
      const res = await deliver(deps, raw, opts);
      assert.equal(res.status, 401);
      assert.equal(rows.length + events.size + calls.length, 0);
    });
  }

  test('rejects a body changed after signing', async () => {
    const { deps, rows } = webhookDeps();
    const header = await signStripePayload(raw, SECRET, Math.floor(NOW / 1000));
    assert.equal((await deliver(deps, raw.replace('active', 'trialing'), { header })).status, 401);
    assert.equal(rows.length, 0);
  });

  test('accepts a timestamp 299 s old', async () => {
    const { deps } = webhookDeps();
    assert.equal((await deliver(deps, raw, { t: Math.floor(NOW / 1000) - 299 })).status, 200);
  });
});

describe('billing-webhook processing', () => {
  test('checkout.session.completed re-reads the subscription and upserts it', async () => {
    const { deps, rows, calls } = webhookDeps({}, stripeSub({ metadata: {} }));
    const res = await deliver(deps, evt('checkout.session.completed', { mode: 'subscription', subscription: 'sub_1', customer: 'cus_1', client_reference_id: ACC, metadata: { venue_account_id: ACC } }));
    assert.equal(res.status, 200);
    assert.equal(calls[0].url, 'https://api.stripe.com/v1/subscriptions/sub_1');
    assert.deepEqual(rows, [{
      venue_account_id: ACC, stripe_customer_id: 'cus_1', stripe_subscription_id: 'sub_1', status: 'active',
      current_period_start: '2025-11-09T12:00:00.000Z', current_period_end: '2025-12-09T12:00:00.000Z', cancel_at_period_end: false,
    }]);
  });

  test('is idempotent: a redelivered event has no side effects', async () => {
    const { deps, rows, calls } = webhookDeps();
    const raw = evt('customer.subscription.updated', stripeSub());
    assert.deepEqual(await read(await deliver(deps, raw)), { ok: true });
    const again = await deliver(deps, raw);
    assert.equal(again.status, 200);
    assert.deepEqual(await read(again), { duplicate: true });
    assert.equal(rows.length, 1);
    assert.equal(calls.length, 1);
  });

  test('an event that failed half-way is processed again on retry', async () => {
    let fail = true;
    const { deps, rows } = webhookDeps({ upsertSubscription: async (row) => (fail ? false : (rows.push(row), true)) });
    const raw = evt('customer.subscription.updated', stripeSub());
    assert.equal((await deliver(deps, raw)).status, 500);
    fail = false;
    assert.equal((await deliver(deps, raw)).status, 200);
    assert.equal(rows.length, 1);
  });

  test('maps the status from the current Stripe state', async () => {
    for (const [stripeStatus, ours] of [['trialing', 'active'], ['unpaid', 'past_due'], ['incomplete_expired', 'canceled'], ['incomplete', 'incomplete']]) {
      const { deps, rows } = webhookDeps({}, stripeSub({ status: stripeStatus }));
      await deliver(deps, evt('customer.subscription.updated', stripeSub({ status: 'active' }), `evt_${stripeStatus}`));
      assert.equal(rows[0].status, ours, stripeStatus);
    }
  });

  test('customer.subscription.deleted trusts the final object without calling Stripe', async () => {
    const { deps, rows, calls } = webhookDeps();
    await deliver(deps, evt('customer.subscription.deleted', stripeSub({ status: 'canceled', cancel_at_period_end: true })));
    assert.equal(calls.length, 0);
    assert.equal(rows[0].status, 'canceled');
  });

  test('invoice events find the subscription in both API shapes', async () => {
    for (const object of [{ subscription: 'sub_1' }, { parent: { subscription_details: { subscription: 'sub_1' } } }]) {
      const { deps, rows } = webhookDeps({}, stripeSub({ status: 'past_due' }));
      assert.equal((await deliver(deps, evt('invoice.payment_failed', object))).status, 200);
      assert.equal(rows[0].status, 'past_due');
    }
    const { deps, rows } = webhookDeps();
    await deliver(deps, evt('invoice.paid', { subscription: 'sub_1' }));
    assert.equal(rows[0].status, 'active');
  });

  test('falls back to the stored ids when Stripe metadata has no account', async () => {
    const seen: unknown[] = [];
    const { deps, rows } = webhookDeps({ accountFor: async (ref) => (seen.push(ref), ACC) }, stripeSub({ metadata: {} }));
    await deliver(deps, evt('customer.subscription.updated', stripeSub({ metadata: {} })));
    assert.deepEqual(seen, [{ subscriptionId: 'sub_1', customerId: 'cus_1' }]);
    assert.equal(rows[0].venue_account_id, ACC);
  });

  test('acknowledges events that are not ours or not handled', async () => {
    const { deps, rows, events } = webhookDeps({}, stripeSub({ metadata: {} }));
    assert.deepEqual(await read(await deliver(deps, evt('customer.subscription.updated', stripeSub({ metadata: {} })))), { ignored: 'unknown_account' });
    assert.deepEqual(await read(await deliver(deps, evt('charge.refunded', {}))), { ignored: true });
    assert.deepEqual(await read(await deliver(deps, evt('checkout.session.completed', { mode: 'payment' }))), { ignored: true });
    assert.equal(rows.length, 0);
    assert.equal(events.get('evt_customer.subscription.updated')?.processed, true);
  });

  test('a Stripe outage answers 500 so Stripe retries', async () => {
    const { deps, events } = webhookDeps({}, [500, { error: { message: 'down' } }]);
    const res = await deliver(deps, evt('invoice.paid', { subscription: 'sub_1' }));
    assert.equal(res.status, 500);
    assert.equal(events.get('evt_invoice.paid')?.processed, false);
  });

  test('bad JSON with a valid signature is a 400; GET is a 405', async () => {
    const { deps } = webhookDeps();
    assert.equal((await deliver(deps, '{nope')).status, 400);
    assert.equal((await billingWebhook(new Request('https://x', { method: 'GET' }), deps)).status, 405);
  });
});
