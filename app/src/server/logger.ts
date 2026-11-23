/**
 * Structured JSON logger and lightweight in-process latency/failure metrics collector.
 * Emits one JSON line per request (`route`, `method`, `status`, `latencyMs`, `cache`, `error`).
 */
export interface RequestLogEntry {
  ts: string;
  level: 'info' | 'warn' | 'error';
  route: string;
  method: string;
  status: number;
  latencyMs: number;
  cache?: 'HIT' | 'MISS' | 'BYPASS';
  error?: string;
}

export interface MetricsSnapshot {
  startedAt: string;
  uptimeSec: number;
  requestsTotal: number;
  status2xx: number;
  status3xx: number;
  status4xx: number;
  status429: number;
  status5xx: number;
  cacheHits: number;
  cacheMisses: number;
  latencyMs: {
    p50: number;
    p95: number;
    p99: number;
    max: number;
    samples: number;
  };
}

const MAX_SAMPLES = 4096;

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return Math.round(sorted[idx] * 100) / 100;
}

export class MetricsCollector {
  private readonly startedAtMs = Date.now();
  private requestsTotal = 0;
  private status2xx = 0;
  private status3xx = 0;
  private status4xx = 0;
  private status429 = 0;
  private status5xx = 0;
  private cacheHits = 0;
  private cacheMisses = 0;
  private readonly samples: number[] = [];
  private sampleCursor = 0;

  record(entry: Omit<RequestLogEntry, 'ts' | 'level'>, emitLog = true): RequestLogEntry {
    this.requestsTotal += 1;
    if (entry.status >= 200 && entry.status < 300) this.status2xx += 1;
    else if (entry.status >= 300 && entry.status < 400) this.status3xx += 1;
    else if (entry.status === 429) {
      this.status4xx += 1;
      this.status429 += 1;
    } else if (entry.status >= 400 && entry.status < 500) this.status4xx += 1;
    else if (entry.status >= 500) this.status5xx += 1;

    if (entry.cache === 'HIT') this.cacheHits += 1;
    else if (entry.cache === 'MISS') this.cacheMisses += 1;

    const latency = Math.max(0, Math.round(entry.latencyMs * 100) / 100);
    if (this.samples.length < MAX_SAMPLES) this.samples.push(latency);
    else this.samples[this.sampleCursor++ % MAX_SAMPLES] = latency;

    const log: RequestLogEntry = {
      ts: new Date().toISOString(),
      level: entry.status >= 500 ? 'error' : entry.status >= 400 ? 'warn' : 'info',
      ...entry,
      latencyMs: latency,
    };

    if (emitLog && process.env.NODE_ENV !== 'test' && process.env.QAB_QUIET_LOGS !== '1') {
      const line = JSON.stringify(log);
      if (log.level === 'error') console.error(line);
      else console.log(line);
    }
    return log;
  }

  snapshot(): MetricsSnapshot {
    const sorted = [...this.samples].sort((a, b) => a - b);
    return {
      startedAt: new Date(this.startedAtMs).toISOString(),
      uptimeSec: Math.round((Date.now() - this.startedAtMs) / 1000),
      requestsTotal: this.requestsTotal,
      status2xx: this.status2xx,
      status3xx: this.status3xx,
      status4xx: this.status4xx,
      status429: this.status429,
      status5xx: this.status5xx,
      cacheHits: this.cacheHits,
      cacheMisses: this.cacheMisses,
      latencyMs: {
        p50: percentile(sorted, 50),
        p95: percentile(sorted, 95),
        p99: percentile(sorted, 99),
        max: sorted.length ? sorted[sorted.length - 1] : 0,
        samples: sorted.length,
      },
    };
  }
}
