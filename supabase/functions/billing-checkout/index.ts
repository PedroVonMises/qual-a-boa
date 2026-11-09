import { createClient } from 'jsr:@supabase/supabase-js@2';

import { billingCheckout } from './handler.ts';
import { createStripe } from './shared.ts';

// Platform-provided: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY.
// Secrets (supabase secrets set ...): STRIPE_SECRET_KEY, STRIPE_PRICE_ID, APP_URL.
const url = Deno.env.get('SUPABASE_URL')!;
const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const stripe = createStripe(Deno.env.get('STRIPE_SECRET_KEY')!);
const config = { priceId: Deno.env.get('STRIPE_PRICE_ID')!, appUrl: Deno.env.get('APP_URL')! };

Deno.serve((req) =>
  billingCheckout(req, {
    async getUser(jwt) {
      const client = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
      const { data, error } = await client.auth.getUser(jwt);
      return error || !data.user ? null : { id: data.user.id, email: data.user.email ?? null };
    },
    async getOwnedAccount(userId, accountId) {
      const { data, error } = await admin
        .from('venue_members')
        .select('role, venue_accounts!inner(id, status, legal_name)')
        .eq('user_id', userId)
        .eq('venue_account_id', accountId)
        .eq('role', 'owner')
        .maybeSingle();
      if (error) throw error;
      const acc = (data as { venue_accounts: { id: string; status: 'pending' | 'verified' | 'rejected'; legal_name: string } } | null)
        ?.venue_accounts;
      return acc ?? null;
    },
    async getSubscription(accountId) {
      const { data, error } = await admin
        .from('subscriptions')
        .select('stripe_customer_id, status')
        .eq('venue_account_id', accountId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    async saveCustomer(accountId, customerId) {
      const { error } = await admin
        .from('subscriptions')
        .upsert({ venue_account_id: accountId, stripe_customer_id: customerId, updated_at: new Date().toISOString() }, {
          onConflict: 'venue_account_id',
        });
      return !error;
    },
    stripe,
    config,
  }),
);
