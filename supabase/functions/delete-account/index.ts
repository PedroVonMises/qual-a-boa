import { createClient } from 'jsr:@supabase/supabase-js@2';

import { deleteAccount } from './handler.ts';

// SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY are provided to every Edge Function by the platform.
// The service-role key never leaves this function.
const url = Deno.env.get('SUPABASE_URL')!;
const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

Deno.serve((req) =>
  deleteAccount(req, {
    async getUser(jwt) {
      // Verify the token with the user-scoped client; the service-role client is only used for the deletion itself.
      const client = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
      const { data, error } = await client.auth.getUser(jwt);
      return error || !data.user ? null : { id: data.user.id };
    },
    async listFolder(bucket, folder, limit) {
      const { data, error } = await admin.storage.from(bucket).list(folder, { limit });
      return error ? null : (data ?? []).filter((f) => f.id !== null).map((f) => f.name);
    },
    async removeFiles(bucket, paths) {
      const { error } = await admin.storage.from(bucket).remove(paths);
      return !error;
    },
    async deleteUser(id) {
      const { error } = await admin.auth.admin.deleteUser(id);
      return !error;
    },
  }),
);
