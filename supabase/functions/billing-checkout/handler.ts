// billing-checkout: starts the Stripe Checkout for the Plano Casas Noturnas (R$ 299/mês) of one venue account.
// Pure and dependency-injected (see ../delete-account/handler.ts): index.ts wires Supabase + Stripe for Deno.
//
// Only an OWNER of a pending|verified account may pay (paying before verification is allowed: festas still need
// `verified`). The Stripe Customer is created once per account and kept in subscriptions.stripe_customer_id; the
// subscription row itself is only written by billing-webhook.

import { bearer, json, readAccountId, CORS, type OwnedAccount, type StripeClient, type SubscriptionInfo } from './shared.ts';

export interface CheckoutDeps {
  getUser(jwt: string): Promise<{ id: string; email: string | null } | null>;
  /** The account when `userId` is one of its owners, else null. */
  getOwnedAccount(userId: string, accountId: string): Promise<OwnedAccount | null>;
  getSubscription(accountId: string): Promise<SubscriptionInfo | null>;
  /** Stores the customer id (creating an `incomplete` subscriptions row if there is none). */
  saveCustomer(accountId: string, customerId: string): Promise<boolean>;
  stripe: StripeClient;
  config: { priceId: string; appUrl: string };
}

export async function billingCheckout(req: Request, deps: CheckoutDeps): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });

  const token = bearer(req);
  if (!token) return json(401, { error: 'unauthorized' });
  let user: { id: string; email: string | null } | null = null;
  try {
    user = await deps.getUser(token);
  } catch {
    user = null;
  }
  if (!user) return json(401, { error: 'unauthorized' });

  const accountId = await readAccountId(req);
  if (!accountId) return json(400, { error: 'invalid_request' });

  try {
    const account = await deps.getOwnedAccount(user.id, accountId);
    if (!account) return json(403, { error: 'not_owner' });
    if (account.status === 'rejected') return json(409, { error: 'account_rejected' });

    const current = await deps.getSubscription(accountId);
    if (current && (current.status === 'active' || current.status === 'past_due')) {
      return json(409, { error: 'already_subscribed' });
    }

    let customer = current?.stripe_customer_id ?? null;
    if (!customer) {
      const created = await deps.stripe.post<{ id: string }>(
        '/v1/customers',
        { email: user.email ?? undefined, name: account.legal_name, metadata: { venue_account_id: accountId } },
        `customer-${accountId}`,
      );
      customer = created.id;
      if (!(await deps.saveCustomer(accountId, customer))) return json(500, { error: 'checkout_failed' });
    }

    const base = deps.config.appUrl.replace(/\/+$/, '');
    const session = await deps.stripe.post<{ url?: string }>('/v1/checkout/sessions', {
      mode: 'subscription',
      customer,
      client_reference_id: accountId,
      line_items: [{ price: deps.config.priceId, quantity: 1 }],
      metadata: { venue_account_id: accountId },
      subscription_data: { metadata: { venue_account_id: accountId } },
      success_url: `${base}/casas/assinatura?status=sucesso&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/casas/assinatura?status=cancelado`,
      locale: 'pt-BR',
    });
    if (!session.url) return json(502, { error: 'checkout_failed' });
    return json(200, { url: session.url });
  } catch {
    // Never leak Stripe or database messages to the client.
    return json(502, { error: 'checkout_failed' });
  }
}
