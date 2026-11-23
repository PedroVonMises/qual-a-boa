import feedDataset from '../public/feed/v1/events.json';
import type { SeedDataset } from '../src/domain/types';
import { CatalogEngine } from '../src/server/catalogEngine';

export interface NodeLikeRequest {
  method?: string;
  url?: string;
  headers: Record<string, string | string[] | undefined>;
  socket?: { remoteAddress?: string };
}

export interface NodeLikeResponse {
  writeHead(status: number, headers: Record<string, string>): void;
  end(body?: string): void;
}

let singleton: CatalogEngine | null = null;

export function getEngine(): CatalogEngine {
  if (singleton) return singleton;
  const origins = (process.env.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const rpm = Number.parseInt(process.env.API_RATE_LIMIT_PER_MIN ?? '240', 10);
  singleton = new CatalogEngine({
    dataset: feedDataset as unknown as SeedDataset,
    rateLimitPerMin: Number.isFinite(rpm) && rpm > 0 ? rpm : 240,
    allowedOrigins: origins.length ? origins : undefined,
  });
  return singleton;
}

export function dispatchNodeRequest(req: NodeLikeRequest, res: NodeLikeResponse, routeOverride?: string): void {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const query: Record<string, string | undefined> = {};
  url.searchParams.forEach((v, k) => {
    query[k] = v;
  });
  const headers: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(req.headers)) {
    headers[k.toLowerCase()] = Array.isArray(v) ? v[0] : v;
  }
  const forwarded = headers['x-forwarded-for']?.split(',')[0]?.trim();
  const clientIp = forwarded || req.socket?.remoteAddress || 'unknown';

  const result = getEngine().handle({
    method: req.method ?? 'GET',
    path: routeOverride ?? url.pathname,
    query,
    headers,
    clientIp,
  });
  res.writeHead(result.status, result.headers);
  res.end(result.body);
}
