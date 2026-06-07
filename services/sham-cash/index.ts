import "server-only";

import { getServerEnv } from "@/lib/env";
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
  ShamCashPaymentStatusResult,
  ShamCashSessionInput,
  ShamCashSessionResult,
  ShamCashWebhookPayload,
} from "@/services/sham-cash/types";

export {
  ShamCashConfigurationError,
  ShamCashEndpointNotConfiguredError,
  ShamCashError,
  ShamCashNetworkError,
  ShamCashProviderError,
  ShamCashTimeoutError,
} from "@/services/sham-cash/errors";
export { SHAM_CASH_DOCUMENTED_API_BASE_URL } from "@/services/sham-cash/constants";
export { resolveShamCashApiBaseUrl } from "@/services/sham-cash/config";
export { buildShamCashAuthHeaders } from "@/services/sham-cash/auth";
export { parseShamCashErrorEnvelope } from "@/services/sham-cash/parse-error";
export { shamCashApiRequest, isRetryableShamCashError } from "@/services/sham-cash/request";
export { buildPollEventId, buildPollWebhookPayload } from "@/services/sham-cash/poll-payload";
export { mapProviderStatusResponse } from "@/services/sham-cash/map-response";
export { createShamCashHttpClient, ShamCashHttpClient } from "@/services/sham-cash/http-client";
export { generatePaymentReferenceCode, isPaymentReferenceCode } from "@/services/sham-cash/reference-code";
export { findPaymentTransaction } from "@/services/sham-cash/transaction-matcher";
export {
  verifySubmittedTransaction,
  TRANSACTION_VERIFICATION_MESSAGES,
} from "@/services/sham-cash/transaction-verifier";
export { getShamCashApiToken } from "@/services/sham-cash/config";
export type { PaymentForMatching, ShamCashTransaction } from "@/services/sham-cash/transaction-matcher";

let cachedAdapter: ShamCashPaymentAdapter | null = null;

/**
 * Mock payments when SHAM_CASH_MOCK=true; otherwise live manual Sham Cash checkout.
 */
export function resolveShamCashMode(): PaymentProviderMode {
  if (process.env.SHAM_CASH_MOCK === "true") return "mock";
  return "live";
}

export function getShamCashAdapter(): ShamCashPaymentAdapter {
  if (!cachedAdapter) {
    cachedAdapter =
      resolveShamCashMode() === "mock" ? new MockShamCashAdapter() : new LiveShamCashAdapter();
  }
  return cachedAdapter;
}

/** Test hook — reset cached adapter after env changes. */
export function resetShamCashAdapterCache(): void {
  cachedAdapter = null;
}

export function isShamCashMockMode(): boolean {
  return getShamCashAdapter().mode === "mock";
}

/** True when an optional webhook signing secret is configured (most Sham Cash setups are API-key-only). */
export function isShamCashWebhooksConfigured(): boolean {
  return Boolean(getServerEnv().SHAM_CASH_WEBHOOK_SECRET);
}

/** How paid orders are confirmed after checkout. */
export type ShamCashConfirmationMode = "mock" | "webhook" | "api_poll" | "transaction_verify";

export function getShamCashConfirmationMode(): ShamCashConfirmationMode {
  if (resolveShamCashMode() === "mock") return "mock";
  if (isShamCashWebhooksConfigured()) return "webhook";
  return "transaction_verify";
}

export async function createShamCashSession(
  input: ShamCashSessionInput,
): Promise<ShamCashSessionResult> {
  return getShamCashAdapter().createSession(input);
}

export async function getShamCashPaymentStatus(providerPaymentId: string) {
  return getShamCashAdapter().getPaymentStatus(providerPaymentId);
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
