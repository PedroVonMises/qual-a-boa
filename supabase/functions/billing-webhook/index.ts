import { createClient } from 'jsr:@supabase/supabase-js@2';

import { createStripe } from '../billing-checkout/shared.ts';
import { billingWebhook } from './handler.ts';

// Deploy with `--no-verify-jwt`: Stripe does not send a Supabase JWT; the Stripe-Signature check replaces it.
// Platform-provided: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY. Secrets: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET.
const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const stripe = createStripe(Deno.env.get('STRIPE_SECRET_KEY')!);
const secret = Deno.env.get('STRIPE_WEBHOOK_SECRET')!;

Deno.serve((req) =>
  billingWebhook(req, {
    secret,
    now: () => Date.now(),
    async claimEvent(id, type, payload) {
      const ins = await admin
        .from('billing_events')
        .upsert({ provider_event_id: id, type, payload }, { onConflict: 'provider_event_id', ignoreDuplicates: true })
        .select('provider_event_id');
      if (ins.error) throw ins.error;
      if (ins.data && ins.data.length > 0) return 'new';
      const { data, error } = await admin.from('billing_events').select('processed_at').eq('provider_event_id', id).single();
      if (error) throw error;
      return data.processed_at ? 'processed' : 'pending';
    },
    async markProcessed(id) {
      const { error } = await admin
        .from('billing_events')
        .update({ processed_at: new Date().toISOString() })
        .eq('provider_event_id', id);
      if (error) throw error;
    },
    async accountFor({ subscriptionId, customerId }) {
      for (const [col, val] of [['stripe_subscription_id', subscriptionId], ['stripe_customer_id', customerId]] as const) {
        if (!val) continue;
        const { data, error } = await admin.from('subscriptions').select('venue_account_id').eq(col, val).limit(1).maybeSingle();
        if (error) throw error;
        if (data) return data.venue_account_id as string;
      }
      return null;
    },
    async upsertSubscription(row) {
      const { error } = await admin
        .from('subscriptions')
        .upsert({ ...row, plan_code: 'casa_mensal', updated_at: new Date().toISOString() }, { onConflict: 'venue_account_id' });
      return !error;
    },
    stripe,
  }),
);
