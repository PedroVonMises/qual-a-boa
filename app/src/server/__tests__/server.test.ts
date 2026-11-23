import seedData from '@/data/seed.json';
import type { SeedDataset } from '@/domain/types';
import { API_MAX_LIMIT, CatalogEngine, sanitizeTextParam } from '../catalogEngine';
import { RateLimiter } from '../rateLimit';

const dataset = seedData as unknown as SeedDataset;

function req(path: string, query: Record<string, string | undefined> = {}, headers: Record<string, string | undefined> = {}, ip = '10.0.0.1', method = 'GET') {
  return { method, path, query, headers, clientIp: ip };
}

describe('RateLimiter', () => {
  it('enforces sliding window burst protection and returns Retry-After on 429', () => {
    const rl = new RateLimiter({ maxRequests: 3, windowMs: 10_000 });
    expect(rl.check('ip1', 1000).allowed).toBe(true);
    expect(rl.check('ip1', 1001).allowed).toBe(true);
    expect(rl.check('ip1', 1002).allowed).toBe(true);
    const blocked = rl.check('ip1', 1003);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(rl.headers(blocked)['Retry-After']).toBeDefined();
    // Window expires -> allowed again
    expect(rl.check('ip1', 12_000).allowed).toBe(true);
  });
});

describe('CatalogEngine (pagination, lean payloads, caching, security, healthcheck)', () => {
  it('/api/health reports healthy status, >= 200 venues, and metrics with no-store', () => {
    const engine = new CatalogEngine({ dataset });
    const res = engine.handle(req('/api/health'));
    expect(res.status).toBe(200);
    expect(res.headers['Cache-Control']).toBe('no-store');
    const body = JSON.parse(res.body);
    expect(body.status).toBe('ok');
    expect(body.catalog.venues).toBeGreaterThanOrEqual(200);
    expect(body.metrics).toBeDefined();
  });

  it('/api/venues enforces strict pagination cap (<= 50) and returns lean cards', () => {
    const engine = new CatalogEngine({ dataset });
    const res = engine.handle(req('/api/venues', { limit: '9999' }));
    expect(res.status).toBe(200);
    expect(res.headers['Cache-Control']).toContain('s-maxage=300');
    expect(res.headers['X-Content-Type-Options']).toBe('nosniff');
    const body = JSON.parse(res.body);
    expect(body.limit).toBe(API_MAX_LIMIT);
    expect(body.items).toHaveLength(API_MAX_LIMIT);
    expect(body.total).toBeGreaterThanOrEqual(200);
    expect(body.nextCursor).toBe(String(API_MAX_LIMIT));
    // Lean payload check: omits internal placeholder flag
    expect(body.items[0].placeholder).toBeUndefined();
    expect(body.items[0].fallbackCover).toMatch(/^\/covers\/[a-z0-9-]+\.svg$/);
  });

  it('/api/events supports combined filters, ETag 304, and edge cache HIT', () => {
    const engine = new CatalogEngine({ dataset });
    const r1 = engine.handle(req('/api/events', { genre: 'funk', priceMax: '40', limit: '10' }));
    expect(r1.status).toBe(200);
    expect(r1.headers['X-Cache']).toBe('MISS');
    const etag = r1.headers.ETag;
    expect(etag).toBeTruthy();

    const r2 = engine.handle(req('/api/events', { genre: 'funk', priceMax: '40', limit: '10' }, { 'if-none-match': etag }));
    expect(r2.status).toBe(304);
    expect(r2.headers['X-Cache']).toBe('HIT');
    expect(r2.body).toBe('');
  });

  it('enforces rate limit burst protection with HTTP 429', () => {
    const engine = new CatalogEngine({ dataset, rateLimitPerMin: 2 });
    expect(engine.handle(req('/api/venues', {}, {}, '203.0.113.9')).status).toBe(200);
    expect(engine.handle(req('/api/venues', {}, {}, '203.0.113.9')).status).toBe(200);
    const r3 = engine.handle(req('/api/venues', {}, {}, '203.0.113.9'));
    expect(r3.status).toBe(429);
    expect(r3.headers['Retry-After']).toBeDefined();
    expect(JSON.parse(r3.body).code).toBe('RATE_LIMITED');
  });

  it('sanitizes control characters and rejects unsupported HTTP methods', () => {
    expect(sanitizeTextParam('  baile\x00\x1f funk  ')).toBe('baile funk');
    const engine = new CatalogEngine({ dataset });
    expect(engine.handle(req('/api/venues', {}, {}, '10.0.0.1', 'DELETE')).status).toBe(405);
    expect(engine.handle(req('/api/venues', {}, {}, '10.0.0.1', 'OPTIONS')).status).toBe(204);
  });
});
