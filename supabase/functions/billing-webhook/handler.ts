// billing-webhook: receives Stripe events and mirrors the subscription into public.subscriptions.
//
// * Authenticity: the Stripe-Signature header (t=<unix>,v1=<hex>[,v1=...]) must carry an HMAC-SHA256 of
//   `${t}.${rawBody}` keyed with STRIPE_WEBHOOK_SECRET, within 300 s of now. Compared in constant time. Else 401.
// * Idempotency: every handled event is claimed in billing_events (provider_event_id unique). A processed event is
//   acknowledged without side effects; an event that failed half-way (claimed, not processed) is processed again.
// * Ordering: Stripe does not guarantee order, so instead of trusting the event payload we re-read the subscription
//   from Stripe (except for customer.subscription.deleted, whose object is final) and upsert its CURRENT state.
// * Errors answer 500 so Stripe retries; nothing internal is leaked.

import { json, subscriptionRow, UUID_RE, type StripeClient, type StripeSubscription, type SubscriptionRow } from '../billing-checkout/shared.ts';

export const SIGNATURE_TOLERANCE_S = 300;

export const HANDLED_EVENTS = [
  'checkout.session.completed',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'invoice.payment_failed',
  'invoice.paid',
] as const;

export interface WebhookDeps {
  secret: string;
  /** Current time in ms (injected for tests). */
  now(): number;
  /** Records the event. 'new' first time, 'pending' when seen but never finished, 'processed' when done. */
  claimEvent(id: string, type: string, payload: unknown): Promise<'new' | 'pending' | 'processed'>;
  markProcessed(id: string): Promise<void>;
  /** Fallback lookup of the venue account by Stripe ids already stored in subscriptions. */
  accountFor(ref: { subscriptionId: string | null; customerId: string | null }): Promise<string | null>;
  upsertSubscription(row: SubscriptionRow): Promise<boolean>;
  stripe: StripeClient;
}

const enc = new TextEncoder();

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function hmacHex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(message)));
  return Array.from(sig, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Verifies a Stripe-Signature header against the raw body. */
export async function verifyStripeSignature(
  header: string | null,
  rawBody: string,
  secret: string,
  nowMs: number,
  toleranceS = SIGNATURE_TOLERANCE_S,
): Promise<boolean> {
  if (!header || !secret) return false;
  let t: string | null = null;
  const v1: string[] = [];
  for (const part of header.split(',')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    const k = part.slice(0, i).trim();
    const v = part.slice(i + 1).trim();
    if (k === 't') t = v;
    else if (k === 'v1') v1.push(v.toLowerCase());
  }
  if (!t || !/^\d+$/.test(t) || v1.length === 0) return false;
  if (Math.abs(nowMs / 1000 - Number(t)) > toleranceS) return false;
  const expected = await hmacHex(secret, `${t}.${rawBody}`);
  let ok = false;
  for (const candidate of v1) ok = timingSafeEqualHex(candidate, expected) || ok; // check all, no early exit
  return ok;
}

/** Signs a payload the way Stripe does (tests and local tooling). */
export async function signStripePayload(rawBody: string, secret: string, tSec: number): Promise<string> {
  return `t=${tSec},v1=${await hmacHex(secret, `${tSec}.${rawBody}`)}`;
}

const idOf = (v: unknown): string | null =>
  typeof v === 'string' ? v : v && typeof v === 'object' && typeof (v as { id?: unknown }).id === 'string' ? (v as { id: string }).id : null;

interface StripeEvent {
  id: string;
  type: string;
  data: { object: Record<string, unknown> };
}

export async function billingWebhook(req: Request, deps: WebhookDeps): Promise<Response> {
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });

  const raw = await req.text();
  if (!(await verifyStripeSignature(req.headers.get('Stripe-Signature'), raw, deps.secret, deps.now()))) {
    return json(401, { error: 'invalid_signature' });
  }

  let event: StripeEvent;
  try {
    event = JSON.parse(raw) as StripeEvent;
    if (typeof event?.id !== 'string' || typeof event.type !== 'string' || typeof event.data?.object !== 'object') throw new Error();
  } catch {
    return json(400, { error: 'invalid_payload' });
  }
  if (!(HANDLED_EVENTS as readonly string[]).includes(event.type)) return json(200, { ignored: true });

  try {
    const claim = await deps.claimEvent(event.id, event.type, event);
    if (claim === 'processed') return json(200, { duplicate: true });

    const obj = event.data.object;
    let subscriptionId: string | null = null;
    let hintedAccount: string | null = null;
    if (event.type === 'checkout.session.completed') {
      if (obj.mode !== 'subscription') return done(deps, event.id, { ignored: true });
      subscriptionId = idOf(obj.subscription);
      const meta = obj.metadata as Record<string, string> | undefined;
      hintedAccount = meta?.venue_account_id ?? (typeof obj.client_reference_id === 'string' ? obj.client_reference_id : null);
    } else if (event.type.startsWith('customer.subscription.')) {
      subscriptionId = idOf(obj.id);
    } else {
      // invoice.*: `subscription` on older API versions, `parent.subscription_details.subscription` on newer ones.
      const parent = obj.parent as { subscription_details?: { subscription?: unknown } } | undefined;
      subscriptionId = idOf(obj.subscription) ?? idOf(parent?.subscription_details?.subscription);
    }
    if (!subscriptionId) return done(deps, event.id, { ignored: true });

    const sub =
      event.type === 'customer.subscription.deleted'
        ? (obj as unknown as StripeSubscription)
        : await deps.stripe.get<StripeSubscription>(`/v1/subscriptions/${encodeURIComponent(subscriptionId)}`);

    const customerId = idOf(sub.customer);
    let accountId = sub.metadata?.venue_account_id ?? hintedAccount;
    if (!accountId || !UUID_RE.test(accountId)) accountId = await deps.accountFor({ subscriptionId, customerId });
    // Not ours (another product on the same Stripe account): acknowledge so Stripe stops retrying.
    if (!accountId || !UUID_RE.test(accountId) || !customerId) return done(deps, event.id, { ignored: 'unknown_account' });

    if (!(await deps.upsertSubscription(subscriptionRow(accountId.toLowerCase(), sub)))) {
      return json(500, { error: 'processing_failed' });
    }
    return done(deps, event.id, { ok: true });
  } catch {
    return json(500, { error: 'processing_failed' });
  }
}

async function done(deps: WebhookDeps, id: string, body: Record<string, unknown>): Promise<Response> {
  await deps.markProcessed(id);
  return json(200, body);
}
