// Public runtime config. Only EXPO_PUBLIC_* variables are readable on the client.
// Never put secrets (service role keys) here.

/** seed = bundled dataset; feed = static JSON feed (data/feedRepo.ts) with the bundled seed as fallback; supabase = remote. */
export type DataSource = 'seed' | 'feed' | 'supabase';

const source = process.env.EXPO_PUBLIC_DATA_SOURCE;
const appEnv = process.env.EXPO_PUBLIC_APP_ENV ?? 'development';

export const DEFAULT_FEED_URL = 'https://qual-a-boa-lime.vercel.app/feed/v1/events.json';

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
