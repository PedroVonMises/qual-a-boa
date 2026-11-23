/**
 * k6 Load Test — Qual a boa? (Target: 10,000 Concurrent Virtual Users)
 *
 * Usage:
 *   BASE_URL=https://qual-a-boa-lime.vercel.app k6 run loadtest/k6-10k.js
 *   BASE_URL=http://127.0.0.1:4100 k6 run loadtest/k6-10k.js
 *
 * Mix mimics peak Friday-night discovery traffic:
 *   55% static CDN feed (/feed/v1/events.json, /feed/v1/venues.json, /covers/*.svg)
 *   25% paginated/filtered venue discovery (/api/venues?limit=20...)
 *   15% filtered event search (/api/events?genre=...&priceMax=...&limit=20)
 *    5% venue detail & health (/api/venues/bolt, /api/health)
 */
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://127.0.0.1:4100';

const errorRate = new Rate('qab_errors');
const feedLatency = new Trend('qab_feed_ms', true);
const apiLatency = new Trend('qab_api_ms', true);

export const options = {
  scenarios: {
    discovery_peak_10k: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '20s', target: 1000 },
        { duration: '30s', target: 5000 },
        { duration: '40s', target: 10000 },
        { duration: '30s', target: 10000 },
        { duration: '20s', target: 0 },
      ],
      gracefulRampDown: '10s',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    qab_errors: ['rate<0.01'],
    http_req_duration: ['p(50)<80', 'p(95)<250', 'p(99)<600'],
    qab_feed_ms: ['p(95)<150'],
    qab_api_ms: ['p(95)<250'],
  },
};

const GENRES = ['funk', 'pagode-samba', 'eletronica-house', 'pop-hits', 'rock-indie', 'sertanejo'];
const AREAS = ['Praia do Canto', 'Jardim da Penha', 'Centro', 'Praia da Costa', 'Vila Velha'];

export default function () {
  const r = Math.random();
  // Distribute X-Forwarded-For across realistic distinct mobile/web users
  const simulatedIp = `198.51.${(__VU >> 8) & 255}.${__VU & 255}`;
  const headers = { 'X-Forwarded-For': simulatedIp, Accept: 'application/json' };

  if (r < 0.40) {
    const res = http.get(`${BASE_URL}/feed/v1/events.json`, { headers });
    feedLatency.add(res.timings.duration);
    const ok = check(res, {
      'feed status 200/304': (x) => x.status === 200 || x.status === 304,
      'feed cache-control': (x) => Boolean(x.headers['Cache-Control']),
    });
    errorRate.add(!ok);
  } else if (r < 0.55) {
    const res = http.get(`${BASE_URL}/feed/v1/venues.json`, { headers });
    feedLatency.add(res.timings.duration);
    const ok = check(res, { 'venues feed 200': (x) => x.status === 200 });
    errorRate.add(!ok);
  } else if (r < 0.80) {
    const area = AREAS[__VU % AREAS.length];
    const res = http.get(`${BASE_URL}/api/venues?limit=20&area=${encodeURIComponent(area)}&sort=distance`, { headers });
    apiLatency.add(res.timings.duration);
    const ok = check(res, {
      'api venues 200': (x) => x.status === 200,
      'api venues <= 50 items': (x) => {
        try {
          return JSON.parse(x.body).items.length <= 50;
        } catch {
          return false;
        }
      },
    });
    errorRate.add(!ok);
  } else if (r < 0.95) {
    const genre = GENRES[__VU % GENRES.length];
    const res = http.get(`${BASE_URL}/api/events?genre=${genre}&priceMax=40&limit=20&sort=popularity`, { headers });
    apiLatency.add(res.timings.duration);
    const ok = check(res, { 'api events 200': (x) => x.status === 200 });
    errorRate.add(!ok);
  } else {
    const path = r < 0.98 ? '/api/venues/bolt' : '/api/health';
    const res = http.get(`${BASE_URL}${path}`, { headers });
    apiLatency.add(res.timings.duration);
    const ok = check(res, { 'detail/health 200': (x) => x.status === 200 });
    errorRate.add(!ok);
  }

  sleep(0.5 + Math.random() * 1.5);
}
