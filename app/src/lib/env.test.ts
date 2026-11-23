import { validateEnv } from './env';

describe('validateEnv (startup environment validation)', () => {
  it('passes with default seed configuration', () => {
    expect(validateEnv({}).ok).toBe(true);
    expect(validateEnv({ EXPO_PUBLIC_DATA_SOURCE: 'seed' }).ok).toBe(true);
  });

  it('rejects unknown data sources', () => {
    const res = validateEnv({ EXPO_PUBLIC_DATA_SOURCE: 'postgres-direct' });
    expect(res.ok).toBe(false);
    expect(res.errors[0]).toMatch(/invalid/i);
  });

  it('requires https Supabase URL and anon key when dataSource=supabase', () => {
    expect(validateEnv({ EXPO_PUBLIC_DATA_SOURCE: 'supabase' }).ok).toBe(false);
    expect(
      validateEnv({
        EXPO_PUBLIC_DATA_SOURCE: 'supabase',
        EXPO_PUBLIC_SUPABASE_URL: 'https://demo.supabase.co',
        EXPO_PUBLIC_SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.anon',
      }).ok,
    ).toBe(true);
  });

  it('blocks accidental service_role secret exposure in EXPO_PUBLIC_* vars', () => {
    const res = validateEnv({
      EXPO_PUBLIC_DATA_SOURCE: 'seed',
      EXPO_PUBLIC_SUPABASE_ANON_KEY: 'role=service_role_secret_key',
    });
    expect(res.ok).toBe(false);
    expect(res.errors[0]).toMatch(/service_role/i);
  });

  it('rejects non-https feed URLs in production', () => {
    const res = validateEnv({
      EXPO_PUBLIC_DATA_SOURCE: 'feed',
      EXPO_PUBLIC_APP_ENV: 'production',
      EXPO_PUBLIC_FEED_URL: 'http://insecure.example/events.json',
    });
    expect(res.ok).toBe(false);
  });
});
