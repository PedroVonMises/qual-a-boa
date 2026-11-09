import { createClient } from 'jsr:@supabase/supabase-js@2';

import { createStripe } from '../billing-checkout/shared.ts';
import { billingPortal } from './handler.ts';

// Platform-provided: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY. Secrets: STRIPE_SECRET_KEY, APP_URL.
const url = Deno.env.get('SUPABASE_URL')!;
const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const stripe = createStripe(Deno.env.get('STRIPE_SECRET_KEY')!);

Deno.serve((req) =>
  billingPortal(req, {
    async getUser(jwt) {
      const client = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
      const { data, error } = await client.auth.getUser(jwt);
      return error || !data.user ? null : { id: data.user.id };
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
      return (data as { venue_accounts: { id: string; status: 'pending' | 'verified' | 'rejected'; legal_name: string } } | null)
        ?.venue_accounts ?? null;
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
    stripe,
    config: { appUrl: Deno.env.get('APP_URL')! },
  }),
);
