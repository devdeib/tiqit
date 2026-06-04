import "server-only";

import {
  getAppEnvironment,
  getServerEnv,
  type AppEnvironment,
  type ServerEnv,
} from "@/lib/env";

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
  }

  return {
    appEnv,
    ok: errors.length === 0,
    errors,
    warnings,
  };
}

export function assertWebhookReadyForDeployment(): void {
  const { appEnv } = { appEnv: getAppEnvironment() };
  const env = getServerEnv();

  if (appEnv === "production") {
    if (!env.SHAM_CASH_WEBHOOK_SECRET) {
      throw new Error("SHAM_CASH_WEBHOOK_SECRET is not configured");
    }
    if (process.env.SHAM_CASH_MOCK === "true") {
      throw new Error("SHAM_CASH_MOCK must not be enabled in production");
    }
  }
}

function resolvePublicAppUrl(env: ServerEnv): string | null {
  if (env.APP_URL?.trim()) return env.APP_URL.trim();
  if (process.env.VERCEL_URL?.trim()) return `https://${process.env.VERCEL_URL.trim()}`;
  return null;
}
