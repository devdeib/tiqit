import type { ShamCashPaymentStatusResult } from "./types";

/**
 * Maps a Sham Cash status-check HTTP response to internal payment lifecycle status.
 * Mapping is completed when GET_PAYMENT_STATUS path and provider status enum are confirmed.
 */
export function mapProviderStatusResponse(
  providerPaymentId: string,
  raw: Record<string, unknown>,
): ShamCashPaymentStatusResult {
  void raw;

  return {
    providerPaymentId,
    status: "pending",
    raw,
  };
}

/**
 * Maps a Sham Cash create-payment HTTP response to session fields.
 * Mapping is completed when CREATE_PAYMENT path and response schema are confirmed.
 */
export function mapCreatePaymentResponse(raw: Record<string, unknown>): {
  providerPaymentId: string;
  redirectUrl: string;
} {
  void raw;

  return {
    providerPaymentId: "",
    redirectUrl: "",
  };
}
