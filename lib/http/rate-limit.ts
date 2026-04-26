/**
 * Phase 15 — simple in-memory rate limiter.
 *
 * Intended for public POST routes (feedback, chat, billing order creation)
 * to blunt casual abuse. Not a substitute for a real WAF or Redis token
 * bucket; Next.js serverless instances share memory only within a single
 * warm runtime, so this is best-effort. Works fine on Node-target Vercel
 * for the scale we expect at launch.
 *
 * Usage:
 *   const rl = rateLimit(req, { key: "feedback", limit: 5, windowMs: 60_000 });
 *   if (!rl.ok) return rl.response;
 */
type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

export function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  return (
    req.headers.get("x-real-ip") ??
    req.headers.get("cf-connecting-ip") ??
    "unknown"
  );
}

export type RateLimitOptions = {
  key: string;
  limit: number;
  windowMs: number;
  /** Extra discriminator (e.g. userId) to isolate buckets per user. */
  identifier?: string;
};

export type RateLimitResult =
  | { ok: true; remaining: number; resetAt: number }
  | {
      ok: false;
      remaining: 0;
      resetAt: number;
      response: Response;
    };

export function rateLimit(
  req: Request,
  opts: RateLimitOptions,
): RateLimitResult {
  const now = Date.now();
  const id = opts.identifier ?? clientIp(req);
  const bucketKey = `${opts.key}:${id}`;
  let bucket = buckets.get(bucketKey);
  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + opts.windowMs };
    buckets.set(bucketKey, bucket);
  }
  bucket.count += 1;
  const remaining = Math.max(0, opts.limit - bucket.count);
  const resetAt = bucket.resetAt;

  // Cheap garbage collection: purge a handful of expired buckets per call.
  if (buckets.size > 1024) {
    let purged = 0;
    for (const [k, b] of buckets) {
      if (b.resetAt <= now) {
        buckets.delete(k);
        if (++purged > 50) break;
      }
    }
  }

  if (bucket.count > opts.limit) {
    const retryAfter = Math.max(1, Math.ceil((resetAt - now) / 1000));
    return {
      ok: false,
      remaining: 0,
      resetAt,
      response: new Response(
        JSON.stringify({
          error: "rate_limited",
          retry_after_seconds: retryAfter,
        }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "Retry-After": String(retryAfter),
            "X-RateLimit-Limit": String(opts.limit),
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": String(Math.ceil(resetAt / 1000)),
          },
        },
      ),
    };
  }
  return { ok: true, remaining, resetAt };
}

/** Test helper — never ship in production paths. */
export function __resetRateLimiter() {
  buckets.clear();
}
