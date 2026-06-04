import "server-only";

import { adminSecretConfigured } from "@/lib/admin-auth";
import {
  getAppEnvironment,
  getServerEnv,
  type AppEnvironment,
  type ServerEnv,
} from "@/lib/env";
import { getAppBaseUrl } from "@/lib/app-url";

export type DeploymentValidation = {
  appEnv: AppEnvironment;
  ok: boolean;
  errors: string[];
  warnings: string[];
};

export function validateDeploymentEnv(): DeploymentValidation {
  const appEnv = getAppEnvironment();
  const errors: string[] = [];
  const warnings: string[] = [];

  let env: ReturnType<typeof getServerEnv>;
  try {
    env = getServerEnv();
  } catch (err) {
    return {
      appEnv,
      ok: false,
      errors: [err instanceof Error ? err.message : "Invalid environment"],
      warnings: [],
    };
  }

  if (!env.HMAC_SECRET_V1) {
    const msg = "HMAC_SECRET_V1 is required for ticket issuance";
    if (appEnv === "production") errors.push(msg);
    else warnings.push(msg);
  }

  if (!resolvePublicAppUrl(env)) {
    const msg = "APP_URL or VERCEL_URL must be set for payment redirects and webhooks";
    if (appEnv !== "development") errors.push(msg);
    else warnings.push(msg);
  }

  if (appEnv === "production") {
    if (process.env.SHAM_CASH_MOCK === "true") {
      errors.push("SHAM_CASH_MOCK must not be true in production");
    }
    if (!env.SHAM_CASH_API_KEY) {
      errors.push("SHAM_CASH_API_KEY is required in production (use live payment adapter)");
    }
    if (!env.SHAM_CASH_WEBHOOK_SECRET) {
      errors.push("SHAM_CASH_WEBHOOK_SECRET is required in production");
    }
    if (process.env.ALLOW_DEV_PAYMENT === "true") {
      errors.push("ALLOW_DEV_PAYMENT must not be enabled in production");
    }
  }

  if (appEnv === "staging") {
    if (!env.SHAM_CASH_WEBHOOK_SECRET && process.env.SHAM_CASH_MOCK !== "true") {
      warnings.push(
        "SHAM_CASH_WEBHOOK_SECRET recommended on staging when not using SHAM_CASH_MOCK",
      );
    }
    if (process.env.ALLOW_DEV_PAYMENT === "true") {
      warnings.push("ALLOW_DEV_PAYMENT is enabled on staging — disable before production");
    }
    if (!adminSecretConfigured()) {
      warnings.push("ADMIN_API_SECRET recommended for staging emergency admin APIs");
    }
  }

  if (appEnv === "production" && !adminSecretConfigured()) {
    warnings.push("ADMIN_API_SECRET recommended for production incident response");
  }

  return {
    appEnv,
    ok: errors.length === 0,
    errors,
    warnings,
  };
}

export function assertWebhookReadyForDeployment(): void {
  const appEnv = getAppEnvironment();
  const env = getServerEnv();

  if (process.env.SHAM_CASH_MOCK === "true" && appEnv === "production") {
    throw new Error("SHAM_CASH_MOCK must not be enabled in production");
  }

  const requiresStrictWebhook =
    appEnv === "production" ||
    (appEnv === "staging" && process.env.SHAM_CASH_MOCK !== "true");

  if (requiresStrictWebhook && !env.SHAM_CASH_WEBHOOK_SECRET) {
    throw new Error("SHAM_CASH_WEBHOOK_SECRET is not configured");
  }
}

export function getDeploymentSummary() {
  const validation = validateDeploymentEnv();
  let appUrl: string | null = null;
  try {
    appUrl = getAppBaseUrl();
  } catch {
    appUrl = null;
  }
  return { ...validation, appUrl };
}

function resolvePublicAppUrl(env: ServerEnv): string | null {
  if (env.APP_URL?.trim()) return env.APP_URL.trim();
  if (process.env.VERCEL_URL?.trim()) return `https://${process.env.VERCEL_URL.trim()}`;
  return null;
}
