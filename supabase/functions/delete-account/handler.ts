// delete-account: erases the calling user (LGPD). Pure and dependency-injected so it runs under Node tests and Deno.
//
// Order matters: Storage files first, then the auth user. Every table references auth.users ON DELETE CASCADE
// (profiles, favorites, follows, check-ins, reports, reviews + votes/reports/photos, tickets + messages +
// attachments), so deleting the user removes the rows, but Storage objects are NOT covered by those cascades.
// If the file cleanup fails we stop BEFORE deleting the user, so the caller can simply retry.

/** Buckets whose objects live under `<user_id>/`. */
export const BUCKETS = ['review-photos', 'support-attachments'] as const;

const LIST_PAGE = 1000;
const MAX_PAGES = 20;

export interface Deps {
  /** The user id behind a verified access token, or null when the token is invalid or has no user (e.g. the anon key). */
  getUser(jwt: string): Promise<{ id: string } | null>;
  /** File names directly inside `<folder>/`, or null on error. */
  listFolder(bucket: string, folder: string, limit: number): Promise<string[] | null>;
  removeFiles(bucket: string, paths: string[]): Promise<boolean>;
  deleteUser(id: string): Promise<boolean>;
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

export async function deleteAccount(req: Request, deps: Deps): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });

  const token = /^Bearer\s+(\S+)$/i.exec(req.headers.get('Authorization') ?? '')?.[1];
  if (!token) return json(401, { error: 'unauthorized' });

  let user: { id: string } | null = null;
  try {
    user = await deps.getUser(token);
  } catch {
    user = null;
  }
  if (!user) return json(401, { error: 'unauthorized' });

  try {
    for (const bucket of BUCKETS) {
      for (let page = 0; ; page++) {
        if (page >= MAX_PAGES) return json(500, { error: 'storage_cleanup_failed' });
        const names = await deps.listFolder(bucket, user.id, LIST_PAGE);
        if (names === null) return json(500, { error: 'storage_cleanup_failed' });
        if (names.length === 0) break;
        if (!(await deps.removeFiles(bucket, names.map((n) => `${user.id}/${n}`)))) {
          return json(500, { error: 'storage_cleanup_failed' });
        }
      }
    }
    if (!(await deps.deleteUser(user.id))) return json(500, { error: 'delete_failed' });
  } catch {
    return json(500, { error: 'delete_failed' });
  }
  return json(200, { ok: true });
}
