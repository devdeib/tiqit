import "server-only";

import { isAppError, toAppError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { isProductionDeploy } from "@/lib/env";

const SENSITIVE_KEY = /password|secret|token|signature|authorization|cookie|api[_-]?key|hmac/i;

function sanitizeContext(context: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(context)) {
    if (SENSITIVE_KEY.test(key)) {
      out[key] = "[redacted]";
      continue;
    }
    if (typeof value === "string" && value.length > 256) {
      out[key] = `${value.slice(0, 256)}…`;
      continue;
    }
    out[key] = value;
  }
  return out;
}

function toSafeError(error: unknown): Record<string, unknown> {
  const appError = isAppError(error) ? error : toAppError(error);
  return {
    code: appError.code,
    status: appError.status,
    message: appError.expose || !isProductionDeploy() ? appError.message : "Internal error",
  };
}

/** Production-safe error reporting — logs only; no third-party SDK yet. */
export function reportProductionError(
  error: unknown,
  context: Record<string, unknown> = {},
): void {
  logger.error("production_error", {
    event: "production_error",
    ...sanitizeContext(context),
    error: toSafeError(error),
  });
}
