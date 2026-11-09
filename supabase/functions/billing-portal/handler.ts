// billing-portal: opens the Stripe Customer Portal (card, invoices, cancel) for a venue account's owner.

import {
  bearer,
  json,
  readAccountId,
  CORS,
  type OwnedAccount,
  type StripeClient,
  type SubscriptionInfo,
} from '../billing-checkout/shared.ts';

export interface PortalDeps {
  getUser(jwt: string): Promise<{ id: string } | null>;
  getOwnedAccount(userId: string, accountId: string): Promise<OwnedAccount | null>;
  getSubscription(accountId: string): Promise<SubscriptionInfo | null>;
  stripe: StripeClient;
  config: { appUrl: string };
}

export async function billingPortal(req: Request, deps: PortalDeps): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });

  const token = bearer(req);
  if (!token) return json(401, { error: 'unauthorized' });
  let user: { id: string } | null = null;
  try {
    user = await deps.getUser(token);
  } catch {
    user = null;
  }
  if (!user) return json(401, { error: 'unauthorized' });

  const accountId = await readAccountId(req);
  if (!accountId) return json(400, { error: 'invalid_request' });

  try {
    if (!(await deps.getOwnedAccount(user.id, accountId))) return json(403, { error: 'not_owner' });
    const sub = await deps.getSubscription(accountId);
    if (!sub?.stripe_customer_id) return json(404, { error: 'no_customer' });
    const session = await deps.stripe.post<{ url?: string }>('/v1/billing_portal/sessions', {
      customer: sub.stripe_customer_id,
      return_url: `${deps.config.appUrl.replace(/\/+$/, '')}/casas/assinatura`,
      locale: 'pt-BR',
    });
    if (!session.url) return json(502, { error: 'portal_failed' });
    return json(200, { url: session.url });
  } catch {
    return json(502, { error: 'portal_failed' });
  }
}
