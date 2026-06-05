import "server-only";

import { logger } from "@/lib/logger";
import { createMemoryRateLimitStore } from "@/lib/rate-limit/memory-store";
import type { RateLimitStore } from "@/lib/rate-limit/types";

/**
 * Distributed rate limit store (Vercel KV / Redis).
 * Falls back to in-memory until RATE_LIMIT_KV_URL + RATE_LIMIT_KV_TOKEN are configured
 * and a KV client is wired here.
 */
export function createKvRateLimitStore(): RateLimitStore {
  const url = process.env.RATE_LIMIT_KV_URL?.trim();
  const token = process.env.RATE_LIMIT_KV_TOKEN?.trim();

  if (!url || !token) {
    logger.warn("rate_limit_kv_not_configured", {
      fallback: "memory",
      hint: "Set RATE_LIMIT_KV_URL and RATE_LIMIT_KV_TOKEN for distributed limits",
    });
    return createMemoryRateLimitStore();
  }

  logger.info("rate_limit_kv_placeholder", {
    message: "KV credentials present; using in-memory store until KV client is implemented",
  });
  return createMemoryRateLimitStore();
}
