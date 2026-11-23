# Qual a boa? — Demo & Operations Runbook

Production-ready MVP runbook covering local setup, idempotent `200+` venue seeding, running the web/mobile demo, executing the `10,000` concurrent-user load test, and verifying system health & release gates.

---

## 1. Prerequisites & Local Setup

- **Node.js:** `>= 22.x` (tested on Node `24.12.0`)
- **npm:** `>= 10.x`
- **Optional:** [k6](https://k6.io/) for external distributed load tests against staging/production URLs

```bash
# Install dependencies
cd app && npm ci
cd ../ingest && npm ci
```

Configure environment variables (optional; defaults to offline-first `seed` mode with zero external keys needed):

```bash
cd app
cp .env.example .env
```

Supported `EXPO_PUBLIC_DATA_SOURCE` modes:
- `seed` *(default)*: Instant local demo over the bundled 226-venue canonical catalog (`app/src/data/seed.json`).
- `feed`: Production read-heavy mode — loads CDN-cached static JSON (`/feed/v1/events.json`) with ETag `304`, AsyncStorage persistence, and bundled offline fallback.
- `supabase`: Direct Supabase PostgREST/RPC backend (requires valid HTTPS `EXPO_PUBLIC_SUPABASE_URL` + `EXPO_PUBLIC_SUPABASE_ANON_KEY`; never place `service_role` keys in `EXPO_PUBLIC_*`).

---

## 2. Seeding & Verifying 200+ Deduplicated Venues

The canonical seed pipeline validates every venue against `app/src/domain/venueSchema.ts`, deduplicates by ID/slug/name+area/proximity (`<= 150m`), generates deterministic local SVG cover fallbacks (`app/public/covers/*.svg`), and writes idempotent `ON CONFLICT DO UPDATE` SQL plus static CDN feeds.

```bash
# 1. Regenerate deterministic local SVG fallback covers (11 assets)
node app/scripts/make-covers.mjs

# 2. Run idempotent seed twice to verify zero duplicates & deterministic output
cd app
npm run seed -- --fixtures
npm run seed
```

Expected output on every run:
- `226 unique valid venues, 65 artists, 478 events`
- Writes:
  - `supabase/seed/seed.sql` (idempotent `INSERT ... ON CONFLICT DO UPDATE`)
  - `app/src/data/seed.json`
  - `app/public/feed/v1/events.json`, `venues.json`, `meta.json`
  - `ingest/data/venues.json`
  - `supabase/tests/fixtures/seed-fixed.json` & `search-cases.json` (with `--fixtures`)

---

## 3. Running the Demo Locally

### Web App (Expo Router + MapLibre GL Clustered Map)
```bash
cd app
npm run web
```
Key demo routes to verify on mobile (`375px`) and desktop (`1280px`):
- `/` — Discovery shelves, search, combined filters, shareable deep link (e.g. `/?genres=funk&priceMax=40&area=Praia+do+Canto`)
- `/mapa` — MapLibre GL with WebGL clustering across 220+ venues and virtualized venue panel
- `/casa/bolt` — Venue detail page with price tier, hours, tags, share link, and upcoming events
- `/evento/<id>` — Event detail page with lineup, ticket handoff, and WhatsApp/clipboard share sheet
- `/busca` — Multi-entity search (Events, Venues, Artists)

### Local Edge + API Server (CDN Feed + Paginated API + Healthcheck)
```bash
node --import ./app/node_modules/tsx/dist/loader.mjs loadtest/server.mjs
```
Verify live endpoints:
```bash
curl -i http://127.0.0.1:4100/api/health
curl -i "http://127.0.0.1:4100/api/venues?limit=20&area=Praia%20do%20Canto&sort=distance"
curl -i "http://127.0.0.1:4100/api/events?genre=funk&priceMax=40&limit=20&sort=popularity"
curl -I http://127.0.0.1:4100/feed/v1/events.json
```

---

## 4. Load Testing (Up to 10,000 Concurrent Users)

### Option A: Zero-Dependency Local 10k VU Benchmark (Reproducible Anywhere)
Spins up the production-parity edge server, runs escalating stages (`500 -> 2,500 -> 5,000 -> 10,000 VUs`), verifies single-IP HTTP `429` burst protection, and writes measured results to `loadtest/RESULTS.md`:

```bash
node --import ./app/node_modules/tsx/dist/loader.mjs loadtest/run-local-benchmark.mjs
```

### Option B: External Staging/Production k6 Load Test
```bash
BASE_URL=https://qual-a-boa-lime.vercel.app k6 run loadtest/k6-10k.js
```

Target SLOs:
- Error rate `< 1%` (excluding intentional single-IP rate-limit bursts)
- `p95 < 250ms`, `p99 < 600ms`
- CDN/Edge cache hit rate `>= 95%` on catalog discovery reads

---

## 5. Healthcheck, Observability & Security Verification

- **Healthcheck (`GET /api/health`):** Returns `200 OK` (`Cache-Control: no-store`) when `catalog.venues >= 200`, or `503 Service Unavailable` when degraded. Payload includes `catalog` counts, Node memory (`rssMb`, `heapUsedMb`), uptime, and rolling `metrics` (`requestsTotal`, `status2xx/3xx/4xx/429/5xx`, `cacheHits/Misses`, `latencyMs.p50/p95/p99/max`).
- **Structured Logs:** Every API/static request emits a single-line JSON log containing `ts`, `level`, `route`, `method`, `status`, `latencyMs`, `cache`, and `error` (set `QAB_QUIET_LOGS=1` only during local benchmarks).
- **Security Controls:**
  - All 23 Supabase tables enforce Row Level Security (`supabase/tests/rls.test.ts` & `schema-seed.test.ts`).
  - Public API enforces `limit <= 50`, parameter sanitization, CORS policy, security headers (`nosniff`, `DENY`, `Referrer-Policy`), and sliding-window rate limiting (`240 req/min/IP` -> `429` with `Retry-After`).
  - `ErrorScreen` never leaks raw stack traces to end users.

---

## 6. Release Gate Checklist

Run all verification commands before every demo or production deploy:

```bash
cd app
npm run typecheck
npm run lint
npm test -- --watchAll=false
npm run test:sql
bash scripts/vercel-build.sh

cd ../ingest
npm test
```

All suites must exit `0` with zero failures.
