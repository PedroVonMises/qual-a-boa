// Public runtime config. Only EXPO_PUBLIC_* variables are readable on the client.
// Never put secrets (service role keys) here.

export type DataSource = 'seed' | 'supabase';

const source = process.env.EXPO_PUBLIC_DATA_SOURCE;

export const env = {
  dataSource: (source === 'supabase' ? 'supabase' : 'seed') as DataSource,
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
} as const;
