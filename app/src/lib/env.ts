// Public runtime config and startup environment validation.
// Only EXPO_PUBLIC_* variables are readable on the client. Never put secrets (service role keys) here.

/** seed = bundled dataset; feed = static JSON feed (data/feedRepo.ts) with the bundled seed as fallback; supabase = remote. */
export type DataSource = 'seed' | 'feed' | 'supabase';

export const DEFAULT_FEED_URL = 'https://qual-a-boa-lime.vercel.app/feed/v1/events.json';
const VALID_SOURCES = new Set(['seed', 'feed', 'supabase']);
const HTTPS_URL_RE = /^https:\/\/[^\s/@]+\.[^\s/@]+/i;
const LOCAL_HTTP_RE = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/i;

export interface EnvValidationResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validates runtime environment variables on startup.
 * Pure function so tests and build scripts can invoke it with synthetic env maps.
 */
export function validateEnv(raw: Record<string, string | undefined> = process.env): EnvValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const source = raw.EXPO_PUBLIC_DATA_SOURCE;
  const appEnv = raw.EXPO_PUBLIC_APP_ENV ?? 'development';
  const supabaseUrl = raw.EXPO_PUBLIC_SUPABASE_URL ?? '';
  const supabaseAnonKey = raw.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';
  const feedUrl = raw.EXPO_PUBLIC_FEED_URL ?? DEFAULT_FEED_URL;

  if (source !== undefined && source !== '' && !VALID_SOURCES.has(source)) {
    errors.push(`EXPO_PUBLIC_DATA_SOURCE "${source}" is invalid; expected seed, feed, or supabase.`);
  }

  // Guard against accidental service_role secret exposure in public client env vars.
  for (const [k, v] of Object.entries(raw)) {
    if (k.startsWith('EXPO_PUBLIC_') && typeof v === 'string' && /service_role/i.test(v)) {
      errors.push(`Security violation: ${k} appears to contain a service_role secret.`);
    }
  }

  if (source === 'supabase') {
    if (!HTTPS_URL_RE.test(supabaseUrl)) {
      errors.push('EXPO_PUBLIC_SUPABASE_URL must be a valid https:// URL when EXPO_PUBLIC_DATA_SOURCE=supabase.');
    }
    if (!supabaseAnonKey || supabaseAnonKey.trim().length < 20) {
      errors.push('EXPO_PUBLIC_SUPABASE_ANON_KEY is required when EXPO_PUBLIC_DATA_SOURCE=supabase.');
    }
  }

  if (source === 'feed') {
    const allowedLocal = appEnv !== 'production' && LOCAL_HTTP_RE.test(feedUrl);
    if (!HTTPS_URL_RE.test(feedUrl) && !allowedLocal) {
      errors.push('EXPO_PUBLIC_FEED_URL must be a valid https:// URL in production.');
    }
  }

  if (appEnv === 'production' && source === 'supabase' && !raw.EXPO_PUBLIC_FEED_URL) {
    warnings.push('Production is pointing directly to Supabase without a static CDN feed override.');
  }

  return { ok: errors.length === 0, errors, warnings };
}

const source = process.env.EXPO_PUBLIC_DATA_SOURCE;
const appEnv = process.env.EXPO_PUBLIC_APP_ENV ?? 'development';

export const env = {
  dataSource: (source === 'supabase' ? 'supabase' : source === 'feed' ? 'feed' : 'seed') as DataSource,
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
  feedUrl: process.env.EXPO_PUBLIC_FEED_URL ?? DEFAULT_FEED_URL,
  appEnv,
  /** Demo tools (Perfil "Dados de demonstração") are hidden only in store/production builds. */
  demoTools: appEnv !== 'production',
  /** Dev only: extra synthetic threads in seed mode (EXPO_PUBLIC_DEMO_THREADS=60) to exercise feed paging. Never in production. */
  demoThreads:
    appEnv === 'production'
      ? 0
      : Math.min(Math.max(Number.parseInt(process.env.EXPO_PUBLIC_DEMO_THREADS ?? '0', 10) || 0, 0), 500),
} as const;

const startupCheck = validateEnv();
if (!startupCheck.ok && process.env.NODE_ENV !== 'test') {
  console.error('[qual-a-boa] Invalid startup environment configuration:', startupCheck.errors.join(' '));
}
