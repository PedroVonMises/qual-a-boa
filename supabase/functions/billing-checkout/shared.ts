// Shared by billing-checkout, billing-portal and billing-webhook (imported as ../billing-checkout/shared.ts).
// Pure: no Deno or Node globals beyond fetch/Request/Response/crypto.subtle, so it runs under Node tests and Deno.
//
// Stripe is called through its REST API (form-encoded) with an injectable fetch, so there is no SDK to bundle and
// tests mock a single function.

export const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

export const bearer = (req: Request) => /^Bearer\s+(\S+)$/i.exec(req.headers.get('Authorization') ?? '')?.[1] ?? null;

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Reads `{ venue_account_id }` from a JSON body; null when missing or malformed. */
export async function readAccountId(req: Request): Promise<string | null> {
  try {
    const body = (await req.json()) as { venue_account_id?: unknown };
    const id = body?.venue_account_id;
    return typeof id === 'string' && UUID_RE.test(id) ? id.toLowerCase() : null;
  } catch {
    return null;
  }
}

// --- Stripe REST ---------------------------------------------------------------------------------------------

type FormValue = string | number | boolean | null | undefined | FormValue[] | { [k: string]: FormValue };

/** Stripe's bracket encoding: { a: { b: 1 }, c: [{ d: 2 }] } -> a[b]=1&c[0][d]=2. null/undefined are skipped. */
export function formEncode(params: Record<string, FormValue>): string {
  const out: string[] = [];
  const walk = (key: string, v: FormValue) => {
    if (v === null || v === undefined) return;
    if (Array.isArray(v)) v.forEach((item, i) => walk(`${key}[${i}]`, item));
    else if (typeof v === 'object') for (const [k, sub] of Object.entries(v)) walk(`${key}[${k}]`, sub);
    else out.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(v))}`);
  };
  for (const [k, v] of Object.entries(params)) walk(k, v);
  return out.join('&');
}

export class StripeError extends Error {
  constructor(public status: number, public code: string | undefined, message: string) {
    super(message);
  }
}

export interface StripeClient {
  post<T = Record<string, unknown>>(path: string, params: Record<string, FormValue>, idempotencyKey?: string): Promise<T>;
  get<T = Record<string, unknown>>(path: string): Promise<T>;
}

export function createStripe(secretKey: string, fetchImpl: typeof fetch = fetch): StripeClient {
  const call = async <T>(method: 'GET' | 'POST', path: string, body?: string, idem?: string): Promise<T> => {
    const headers: Record<string, string> = { Authorization: `Bearer ${secretKey}` };
    if (body !== undefined) headers['Content-Type'] = 'application/x-www-form-urlencoded';
    if (idem) headers['Idempotency-Key'] = idem;
    const res = await fetchImpl(`https://api.stripe.com${path}`, { method, headers, body });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown> & { error?: { code?: string; message?: string } };
    if (!res.ok) throw new StripeError(res.status, data.error?.code, data.error?.message ?? `stripe ${res.status}`);
    return data as T;
  };
  return {
    post: (path, params, idem) => call('POST', path, formEncode(params), idem),
    get: (path) => call('GET', path),
  };
}

// --- Subscriptions ---------------------------------------------------------------------------------------------

export type SubscriptionStatus = 'incomplete' | 'active' | 'past_due' | 'canceled';

/** Stripe subscription.status -> our subscriptions.status. Unknown statuses grant nothing. */
export function mapStripeStatus(s: string | null | undefined): SubscriptionStatus {
  switch (s) {
    case 'trialing':
    case 'active':
      return 'active';
    case 'past_due':
    case 'unpaid':
      return 'past_due';
    case 'canceled':
    case 'incomplete_expired':
      return 'canceled';
    default:
      // 'incomplete', 'paused' (trial ended without a payment method) and anything new: no access.
      return 'incomplete';
  }
}

export interface StripeSubscription {
  id: string;
  status: string;
  customer: string | { id: string };
  cancel_at_period_end?: boolean;
  /** Older API versions. Since 2025-03-31 the period lives on each subscription item. */
  current_period_start?: number;
  current_period_end?: number;
  items?: { data?: Array<{ current_period_start?: number; current_period_end?: number }> };
  metadata?: Record<string, string>;
}

export interface SubscriptionRow {
  venue_account_id: string;
  stripe_customer_id: string;
  stripe_subscription_id: string;
  status: SubscriptionStatus;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
}

const iso = (sec: number | undefined) => (typeof sec === 'number' ? new Date(sec * 1000).toISOString() : null);

export function subscriptionRow(accountId: string, sub: StripeSubscription): SubscriptionRow {
  const item = sub.items?.data?.[0];
  return {
    venue_account_id: accountId,
    stripe_customer_id: typeof sub.customer === 'string' ? sub.customer : sub.customer.id,
    stripe_subscription_id: sub.id,
    status: mapStripeStatus(sub.status),
    current_period_start: iso(sub.current_period_start ?? item?.current_period_start),
    current_period_end: iso(sub.current_period_end ?? item?.current_period_end),
    cancel_at_period_end: !!sub.cancel_at_period_end,
  };
}

/** Owner check shared by checkout and portal. */
export interface OwnedAccount {
  id: string;
  status: 'pending' | 'verified' | 'rejected';
  legal_name: string;
}

export interface SubscriptionInfo {
  stripe_customer_id: string | null;
  status: SubscriptionStatus;
}
