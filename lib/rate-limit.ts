import "server-only";

import { AppError } from "@/lib/errors";

type Bucket = {
  count: number;
  resetAt: number;
};

const stores = new Map<string, Map<string, Bucket>>();

export type RateLimitConfig = {
  /** Unique bucket name, e.g. `guest-write` */
  name: string;
  /** Max requests per window */
  limit: number;
  /** Window size in seconds */
  windowSec: number;
};

function pruneStore(store: Map<string, Bucket>, now: number): void {
  for (const [key, bucket] of store) {
    if (bucket.resetAt <= now) store.delete(key);
  }
}

/**
 * In-memory rate limit (per serverless instance).
 * Replace with Redis / Vercel KV before high-traffic production.
 */
export function checkRateLimit(config: RateLimitConfig, key: string): void {
  const now = Date.now();
  let store = stores.get(config.name);
  if (!store) {
    store = new Map();
    stores.set(config.name, store);
  }

  if (store.size > 10_000) pruneStore(store, now);

  const bucket = store.get(key);
  if (!bucket || bucket.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + config.windowSec * 1000 });
    return;
  }

  bucket.count += 1;
  if (bucket.count > config.limit) {
    throw new AppError("Too many requests", {
      code: "RATE_LIMITED",
      status: 429,
      expose: true,
      details: { retryAfterSec: Math.ceil((bucket.resetAt - now) / 1000) },
    });
  }
}

export function clientIpFromRequest(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() ?? "unknown";
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return "unknown";
}

export const RATE_LIMITS = {
  guestWrite: { name: "guest-write", limit: 30, windowSec: 60 },
  guestRead: { name: "guest-read", limit: 120, windowSec: 60 },
  webhook: { name: "webhook", limit: 200, windowSec: 60 },
  admin: { name: "admin", limit: 60, windowSec: 60 },
} as const satisfies Record<string, RateLimitConfig>;
