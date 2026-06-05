import "server-only";

import { AppError } from "@/lib/errors";
import { createKvRateLimitStore } from "@/lib/rate-limit/kv-store";
import { createMemoryRateLimitStore } from "@/lib/rate-limit/memory-store";
import type { RateLimitConfig, RateLimitStore } from "@/lib/rate-limit/types";

export type { RateLimitConfig, RateLimitResult, RateLimitStore } from "@/lib/rate-limit/types";

let cachedStore: RateLimitStore | null = null;

function getRateLimitStore(): RateLimitStore {
  if (cachedStore) return cachedStore;

  const backend = process.env.RATE_LIMIT_BACKEND?.trim() ?? "memory";
  cachedStore = backend === "kv" ? createKvRateLimitStore() : createMemoryRateLimitStore();
  return cachedStore;
}

/** Reset store selection (tests only). */
export function resetRateLimitStoreForTests(): void {
  cachedStore = null;
}

export function checkRateLimit(config: RateLimitConfig, key: string): void {
  const result = getRateLimitStore().check(config, key);
  if (!result.allowed) {
    throw new AppError("Too many requests", {
      code: "RATE_LIMITED",
      status: 429,
      expose: true,
      details: { retryAfterSec: result.retryAfterSec ?? config.windowSec },
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
  organizerWrite: { name: "organizer-write", limit: 60, windowSec: 60 },
  organizerRead: { name: "organizer-read", limit: 120, windowSec: 60 },
  webhook: { name: "webhook", limit: 200, windowSec: 60 },
  admin: { name: "admin", limit: 60, windowSec: 60 },
  adminRead: { name: "admin-read", limit: 120, windowSec: 60 },
  adminWrite: { name: "admin-write", limit: 60, windowSec: 60 },
  staffRead: { name: "staff-read", limit: 120, windowSec: 60 },
  staffWrite: { name: "staff-write", limit: 90, windowSec: 60 },
} as const satisfies Record<string, RateLimitConfig>;
