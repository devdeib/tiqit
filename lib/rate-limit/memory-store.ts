import type { RateLimitConfig, RateLimitResult, RateLimitStore } from "@/lib/rate-limit/types";

type Bucket = {
  count: number;
  resetAt: number;
};

const stores = new Map<string, Map<string, Bucket>>();

function pruneStore(store: Map<string, Bucket>, now: number): void {
  for (const [key, bucket] of store) {
    if (bucket.resetAt <= now) store.delete(key);
  }
}

export function createMemoryRateLimitStore(): RateLimitStore {
  return {
    check(config: RateLimitConfig, key: string): RateLimitResult {
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
        return { allowed: true };
      }

      bucket.count += 1;
      if (bucket.count > config.limit) {
        return {
          allowed: false,
          retryAfterSec: Math.ceil((bucket.resetAt - now) / 1000),
        };
      }

      return { allowed: true };
    },
  };
}
