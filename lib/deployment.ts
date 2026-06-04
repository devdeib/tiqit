import "server-only";

import { adminSecretConfigured } from "@/lib/admin-auth";
import {
  getAppEnvironment,
  getServerEnv,
  type AppEnvironment,
} from "@/lib/env";
import { getAppBaseUrl, getConfiguredAppUrl, isProductionAppUrlMisconfigured } from "@/lib/app-url";
import {
  getShamCashConfirmationMode,
  isShamCashWebhooksConfigured,
  resolveShamCashMode,
} from "@/services/sham-cash";

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

  if (!getAppBaseUrl()) {
    const msg = "APP_URL or VERCEL_URL must be set for payment redirects and webhooks";
    if (appEnv !== "development") errors.push(msg);
    else warnings.push(msg);
  }

  if (appEnv === "production" && isProductionAppUrlMisconfigured()) {
    errors.push(
      "APP_URL is set to localhost in production — update Vercel to your public HTTPS URL (e.g. https://your-app.vercel.app)",
    );
  }

  if (appEnv === "production") {
    if (resolveShamCashMode() === "live" && !isShamCashWebhooksConfigured()) {
      warnings.push(
        "Sham Cash live mode without webhook secret — implement API polling in live-adapter.ts or set SHAM_CASH_WEBHOOK_SECRET",
      );
    }
    if (resolveShamCashMode() === "mock" && env.SHAM_CASH_API_KEY) {
      warnings.push(
        "SHAM_CASH_API_KEY is set but ignored (mock mode). Remove from Vercel or set SHAM_CASH_FORCE_LIVE=true when ready for live payments",
      );
    }
    if (process.env.ALLOW_DEV_PAYMENT === "true") {
      warnings.push(
        "ALLOW_DEV_PAYMENT is enabled on production — not required for mock checkout; disable when using live Sham Cash",
      );
    }
  }

  if (appEnv === "staging") {
    if (
      process.env.SHAM_CASH_FORCE_LIVE === "true" &&
      env.SHAM_CASH_API_KEY &&
      !isShamCashWebhooksConfigured()
    ) {
      warnings.push(
        "SHAM_CASH_WEBHOOK_SECRET unset — live staging uses API polling, not /api/webhooks/sham-cash",
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

  if (!isShamCashWebhooksConfigured()) {
    throw new Error(
      "Sham Cash webhooks are not configured (set SHAM_CASH_WEBHOOK_SECRET only if your provider sends signed callbacks)",
    );
  }
}

export function getDeploymentSummary() {
  const validation = validateDeploymentEnv();
  let appUrl: string | null = null;
  let configuredAppUrl: string | null = null;
  try {
    appUrl = getAppBaseUrl();
    configuredAppUrl = getConfiguredAppUrl();
  } catch {
    appUrl = null;
  }
  let paymentConfirmation: ReturnType<typeof getShamCashConfirmationMode> = "mock";
  try {
    paymentConfirmation = getShamCashConfirmationMode();
  } catch {
    paymentConfirmation = "mock";
  }

  return { ...validation, appUrl, configuredAppUrl, paymentConfirmation };
}
