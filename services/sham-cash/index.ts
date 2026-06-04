import "server-only";

import { getAppEnvironment, getServerEnv } from "@/lib/env";
import { LiveShamCashAdapter } from "@/services/sham-cash/live-adapter";
import { MockShamCashAdapter } from "@/services/sham-cash/mock-adapter";
import type {
  PaymentProviderMode,
  ShamCashPaymentAdapter,
  ShamCashSessionInput,
  ShamCashSessionResult,
} from "@/services/sham-cash/types";

export type {
  PaymentProviderMode,
  ShamCashPaymentAdapter,
  ShamCashSessionInput,
  ShamCashSessionResult,
  ShamCashWebhookPayload,
} from "@/services/sham-cash/types";

let cachedAdapter: ShamCashPaymentAdapter | null = null;

export function resolveShamCashMode(): PaymentProviderMode {
  if (process.env.SHAM_CASH_MOCK === "true") return "mock";

  const appEnv = getAppEnvironment();

  // Staging/local use mock until live-adapter.ts implements the real API.
  // Set SHAM_CASH_FORCE_LIVE=true (and API key) on staging to test live when ready.
  if (appEnv === "development" || appEnv === "staging") {
    if (process.env.SHAM_CASH_FORCE_LIVE === "true" && getServerEnv().SHAM_CASH_API_KEY) {
      return "live";
    }
    return "mock";
  }

  const env = getServerEnv();
  if (appEnv === "production") {
    return env.SHAM_CASH_API_KEY ? "live" : "mock";
  }

  return env.SHAM_CASH_API_KEY ? "live" : "mock";
}

export function getShamCashAdapter(): ShamCashPaymentAdapter {
  if (!cachedAdapter) {
    cachedAdapter =
      resolveShamCashMode() === "mock" ? new MockShamCashAdapter() : new LiveShamCashAdapter();
  }
  return cachedAdapter;
}

export function isShamCashMockMode(): boolean {
  return getShamCashAdapter().mode === "mock";
}

export async function createShamCashSession(
  input: ShamCashSessionInput,
): Promise<ShamCashSessionResult> {
  return getShamCashAdapter().createSession(input);
}

export function verifyShamCashWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
): boolean {
  return getShamCashAdapter().verifyWebhookSignature(rawBody, signatureHeader);
}

export function parseShamCashWebhookPayload(rawBody: string): {
  providerEventId: string;
  providerPaymentId: string;
  orderId?: string;
  status: "completed" | "failed";
  amount?: number;
} {
  const payload = JSON.parse(rawBody) as {
    event_id?: string;
    payment_id?: string;
    order_id?: string;
    status?: string;
    amount?: number;
  };

  if (!payload.payment_id || typeof payload.payment_id !== "string") {
    throw new Error("Invalid webhook payload: payment_id is required");
  }

  return {
    providerEventId: payload.event_id ?? payload.payment_id,
    providerPaymentId: payload.payment_id,
    orderId: payload.order_id,
    status: payload.status === "completed" ? "completed" : "failed",
    amount: typeof payload.amount === "number" ? payload.amount : undefined,
  };
}
