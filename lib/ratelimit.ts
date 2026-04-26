import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

let _redis: Redis | null = null;
function getRedis(): Redis | null {
  if (_redis) return _redis;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  _redis = new Redis({ url, token });
  return _redis;
}

/**
 * Chat rate limit: 30 messages per hour per student.
 * If Upstash is not configured, returns a pass-through limiter (dev only).
 */
export function chatLimiter() {
  const redis = getRedis();
  if (!redis) {
    return {
      limit: async () => ({ success: true, remaining: 9999, reset: 0 }),
    };
  }
  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(30, "1 h"),
    analytics: true,
    prefix: "rl:chat",
  });
}
