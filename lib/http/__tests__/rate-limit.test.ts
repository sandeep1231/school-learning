import { describe, it, expect, beforeEach } from "vitest";
import { rateLimit, __resetRateLimiter } from "../rate-limit";

function makeReq(ip = "1.2.3.4"): Request {
  return new Request("http://x.test/y", {
    method: "POST",
    headers: { "x-forwarded-for": ip },
  });
}

describe("rateLimit", () => {
  beforeEach(() => __resetRateLimiter());

  it("allows requests within the limit", () => {
    for (let i = 0; i < 3; i += 1) {
      const r = rateLimit(makeReq(), {
        key: "test",
        limit: 3,
        windowMs: 60_000,
      });
      expect(r.ok).toBe(true);
    }
  });

  it("returns 429 when over the limit", () => {
    const opts = { key: "test", limit: 2, windowMs: 60_000 };
    expect(rateLimit(makeReq(), opts).ok).toBe(true);
    expect(rateLimit(makeReq(), opts).ok).toBe(true);
    const third = rateLimit(makeReq(), opts);
    expect(third.ok).toBe(false);
    if (!third.ok) {
      expect(third.response.status).toBe(429);
      expect(third.response.headers.get("Retry-After")).toBeTruthy();
    }
  });

  it("isolates buckets per IP", () => {
    const opts = { key: "test", limit: 1, windowMs: 60_000 };
    expect(rateLimit(makeReq("1.1.1.1"), opts).ok).toBe(true);
    expect(rateLimit(makeReq("2.2.2.2"), opts).ok).toBe(true);
    expect(rateLimit(makeReq("1.1.1.1"), opts).ok).toBe(false);
  });

  it("isolates buckets per key", () => {
    expect(
      rateLimit(makeReq(), { key: "a", limit: 1, windowMs: 60_000 }).ok,
    ).toBe(true);
    expect(
      rateLimit(makeReq(), { key: "b", limit: 1, windowMs: 60_000 }).ok,
    ).toBe(true);
  });

  it("honours custom identifier", () => {
    const opts = {
      key: "test",
      limit: 1,
      windowMs: 60_000,
      identifier: "user-123",
    };
    expect(rateLimit(makeReq("1.1.1.1"), opts).ok).toBe(true);
    // Different IP but same identifier → should still be blocked.
    expect(rateLimit(makeReq("9.9.9.9"), opts).ok).toBe(false);
  });
});
