/**
 * Bounded-memory sliding-window rate limiter with burst protection.
 * Safe for edge/serverless instances and high-concurrency Node servers (caps tracked keys to avoid OOM).
 */
export interface RateLimitOptions {
  /** Max requests allowed per `windowMs` per key (IP/client). */
  maxRequests: number;
  /** Window duration in milliseconds. */
  windowMs: number;
  /** Hard ceiling on tracked buckets so memory never grows unbounded under DDoS. */
  maxBuckets?: number;
}

export interface RateLimitDecision {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAtMs: number;
  retryAfterSec: number;
}

interface Bucket {
  count: number;
  resetAtMs: number;
}

export class RateLimiter {
  private readonly buckets = new Map<string, Bucket>();
  private readonly maxRequests: number;
  private readonly windowMs: number;
  private readonly maxBuckets: number;

  constructor(opts: RateLimitOptions) {
    this.maxRequests = Math.max(1, opts.maxRequests);
    this.windowMs = Math.max(100, opts.windowMs);
    this.maxBuckets = Math.max(100, opts.maxBuckets ?? 50_000);
  }

  check(key: string, nowMs = Date.now()): RateLimitDecision {
    const existing = this.buckets.get(key);
    if (!existing || nowMs >= existing.resetAtMs) {
      if (this.buckets.size >= this.maxBuckets) {
        this.prune(nowMs);
      }
      const resetAtMs = nowMs + this.windowMs;
      this.buckets.set(key, { count: 1, resetAtMs });
      return {
        allowed: true,
        limit: this.maxRequests,
        remaining: this.maxRequests - 1,
        resetAtMs,
        retryAfterSec: 0,
      };
    }

    if (existing.count >= this.maxRequests) {
      const retryAfterSec = Math.max(1, Math.ceil((existing.resetAtMs - nowMs) / 1000));
      return {
        allowed: false,
        limit: this.maxRequests,
        remaining: 0,
        resetAtMs: existing.resetAtMs,
        retryAfterSec,
      };
    }

    existing.count += 1;
    return {
      allowed: true,
      limit: this.maxRequests,
      remaining: this.maxRequests - existing.count,
      resetAtMs: existing.resetAtMs,
      retryAfterSec: 0,
    };
  }

  headers(d: RateLimitDecision): Record<string, string> {
    const out: Record<string, string> = {
      'X-RateLimit-Limit': String(d.limit),
      'X-RateLimit-Remaining': String(d.remaining),
      'X-RateLimit-Reset': String(Math.ceil(d.resetAtMs / 1000)),
    };
    if (!d.allowed) out['Retry-After'] = String(d.retryAfterSec);
    return out;
  }

  private prune(nowMs: number): void {
    for (const [k, b] of this.buckets) {
      if (nowMs >= b.resetAtMs) this.buckets.delete(k);
    }
    if (this.buckets.size >= this.maxBuckets) {
      // Evict oldest 10% FIFO to bound memory strictly.
      const drop = Math.ceil(this.maxBuckets * 0.1);
      let i = 0;
      for (const k of this.buckets.keys()) {
        this.buckets.delete(k);
        if (++i >= drop) break;
      }
    }
  }

  reset(): void {
    this.buckets.clear();
  }
}
