/**
 * Production-parity local HTTP server for Qual a boa?
 * Serves:
 *   - Static CDN-cached catalog feeds (`/feed/v1/*`) & deterministic local SVG covers (`/covers/*`)
 *     with pre-gzipped in-memory edge buffers, ETag, and `Cache-Control` headers.
 *   - Paginated, rate-limited, structured-logging API routes (`/api/health`, `/api/venues`, `/api/events`).
 *   - Tuned Node HTTP timeouts & keep-alive pooling for high concurrency.
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

import { CatalogEngine } from '../app/src/server/catalogEngine.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APP_PUBLIC = path.resolve(__dirname, '..', 'app', 'public');

const MIME = {
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
};

function preloadStatic(relPath, cacheControl) {
  const full = path.join(APP_PUBLIC, relPath);
  if (!existsSync(full)) return null;
  const raw = readFileSync(full);
  const gz = gzipSync(raw, { level: 6 });
  const etag = `"${createHash('sha1').update(raw).digest('hex').slice(0, 14)}"`;
  const ext = path.extname(relPath);
  return {
    raw,
    gz,
    etag,
    contentType: MIME[ext] ?? 'application/octet-stream',
    cacheControl,
  };
}

export function createProductionServer(opts = {}) {
  const feedPath = path.join(APP_PUBLIC, 'feed', 'v1', 'events.json');
  const dataset = JSON.parse(readFileSync(feedPath, 'utf8'));
  const engine = new CatalogEngine({
    dataset,
    rateLimitPerMin: opts.rateLimitPerMin ?? 240,
  });

  // Pre-warm CDN/Edge static cache
  const staticAssets = new Map();
  for (const rel of ['feed/v1/events.json', 'feed/v1/venues.json', 'feed/v1/meta.json']) {
    const entry = preloadStatic(rel, 'public, max-age=60, s-maxage=300, stale-while-revalidate=3600');
    if (entry) staticAssets.set(`/${rel}`, entry);
  }
  for (const slug of [
    'funk', 'pagode-samba', 'sertanejo', 'eletronica-house', 'pop-hits',
    'rock-indie', 'metal-punk-goth', 'forro-tecnobrega', 'hip-hop-rnb', 'karaoke-ao-vivo', 'generic',
  ]) {
    const entry = preloadStatic(`covers/${slug}.svg`, 'public, max-age=86400, s-maxage=604800, immutable');
    if (entry) staticAssets.set(`/covers/${slug}.svg`, entry);
  }

  const server = http.createServer((req, res) => {
    const start = performance.now();
    const url = new URL(req.url ?? '/', 'http://localhost');
    const pathname = url.pathname;

    // 1. Static CDN Edge Cache path (zero DB / zero compute)
    const asset = staticAssets.get(pathname);
    if (asset && (req.method === 'GET' || req.method === 'HEAD')) {
      const inm = req.headers['if-none-match'];
      const acceptGzip = String(req.headers['accept-encoding'] ?? '').includes('gzip');
      const baseHeaders = {
        'Content-Type': asset.contentType,
        'Cache-Control': asset.cacheControl,
        ETag: asset.etag,
        'X-Cache': 'HIT',
        'X-Content-Type-Options': 'nosniff',
        'Access-Control-Allow-Origin': '*',
      };
      if (inm === asset.etag) {
        res.writeHead(304, baseHeaders);
        res.end();
        engine.metrics.record({ route: pathname, method: req.method, status: 304, latencyMs: performance.now() - start, cache: 'HIT' });
        return;
      }
      const payload = acceptGzip ? asset.gz : asset.raw;
      res.writeHead(200, {
        ...baseHeaders,
        ...(acceptGzip ? { 'Content-Encoding': 'gzip', Vary: 'Accept-Encoding' } : {}),
        'Content-Length': String(payload.length),
      });
      res.end(req.method === 'HEAD' ? undefined : payload);
      engine.metrics.record({ route: pathname, method: req.method, status: 200, latencyMs: performance.now() - start, cache: 'HIT' });
      return;
    }

    // 2. API Routes via CatalogEngine
    const query = {};
    for (const [k, v] of url.searchParams.entries()) query[k] = v;
    const headers = {};
    for (const [k, v] of Object.entries(req.headers)) headers[k.toLowerCase()] = Array.isArray(v) ? v[0] : v;
    const clientIp = headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress || '127.0.0.1';

    const out = engine.handle({
      method: req.method ?? 'GET',
      path: pathname,
      query,
      headers,
      clientIp,
    });
    res.writeHead(out.status, out.headers);
    res.end(out.body);
  });

  // High-concurrency HTTP server tuning (prevent premature keep-alive socket close races under 10k VUs)
  server.keepAliveTimeout = 60_000;
  server.headersTimeout = 65_000;
  server.requestTimeout = 10_000;
  server.maxRequestsPerSocket = 0;

  return { server, engine };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT ?? 4100);
  const { server } = createProductionServer();
  server.listen(port, '127.0.0.1', () => {
    console.log(JSON.stringify({ ts: new Date().toISOString(), level: 'info', msg: 'qual-a-boa edge server listening', port }));
  });
}
