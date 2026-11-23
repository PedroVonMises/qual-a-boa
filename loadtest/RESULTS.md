# Load Test Results — Qual a boa? (Up to 10,000 Concurrent Virtual Users)

- **Executed:** 2026-11-23T16:36:22.143Z
- **Runtime:** Node v24.12.0 on local single-process production-parity server (`loadtest/server.mjs`)
- **Catalog Size:** 226 validated unique venues, 478 events, 65 artists
- **Traffic Mix:** 40% `/feed/v1/events.json` (gzip + ETag 304), 15% `/feed/v1/venues.json`, 25% `/api/venues?limit=20&area=...`, 15% `/api/events?genre=...&priceMax=40&limit=20`, 5% `/api/venues/bolt` & `/api/health`

## Concurrency Ramp Results

| Virtual Users | Requests | Throughput | p50 | p95 | p99 | Error Rate | Cache Hit | Avg Payload |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 500 | 1,000 | 3,803 req/s | 10.84 ms | 15.68 ms | 37.41 ms | 0% | 96.3% | 16.69 KB |
| 2,500 | 5,000 | 5,282 req/s | 17.52 ms | 22.34 ms | 36.88 ms | 0% | 97.5% | 16.69 KB |
| 5,000 | 10,000 | 5,843 req/s | 20.95 ms | 27.01 ms | 39.85 ms | 0% | 97.5% | 16.69 KB |
| 10,000 | 20,000 | 6,216 req/s | 24.87 ms | 31.3 ms | 34.37 ms | 0% | 97.5% | 16.69 KB |

## Rate Limiting & Burst Protection Verification

- **Policy:** 240 requests / 60s per client IP on `/api/*` catalog routes (healthcheck exempt, bounded bucket map <= 50,000 keys)
- **Single-IP Burst Test (260 concurrent requests):** `200 OK = 240`, `429 Too Many Requests = 20` (with `Retry-After` and `X-RateLimit-*` headers)

## Server Metrics Snapshot

- **Total Requests Processed:** 36,261
- **2xx / 3xx / 429 / 5xx:** 29041 / 7200 / 20 / 0
- **Overall Latency (last 4096 samples):** p50=0.02ms, p95=0.03ms, p99=0.39ms

## Architecture & Bottleneck Analysis for 10,000 Concurrent Users

1. **Read/Write Separation (Zero DB Exhaustion):** Under 10,000 concurrent users, catalog discovery reads hit CDN-cached static JSON feeds (`/feed/v1/events.json`, `/feed/v1/venues.json`) and Edge-cached paginated API responses (`s-maxage=120..300`, `stale-while-revalidate=600..3600`). Supabase Postgres only handles authenticated mutations (favorites, reviews, community threads, live check-ins) and fallback RPC searches.
2. **Database Indexing & Spatial Pre-filter:** Migration `0015_perf_indexes_and_search.sql` adds composite partial indexes on `events` (`starts_at`, `venue_id`, `popularity`, `price_min`), partial spatial/area indexes on `venues`, GIN indexes on `access_tags` and `genre_slugs`, a bounding-box pre-filter before `haversine_km`, and a hard SQL `p_limit` ceiling.
3. **Payload & Pagination Discipline:** Public API enforces `limit <= 50` and strips internal fields; gzip compression + ETag `304 Not Modified` keeps average transfer payload tiny.
4. **External k6 Reproduction:** Run `BASE_URL=https://<your-deployment> k6 run loadtest/k6-10k.js` to validate against Vercel Edge CDN in staging/production.
