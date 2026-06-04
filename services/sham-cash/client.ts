import { getServerEnv } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { createHash } from "crypto";

export type ShamCashSessionInput = {
  orderId: string;
  amount: number;
  currency: string;
  customerPhone: string;
  description: string;
};

export type ShamCashSessionResult = {
  providerPaymentId: string;
  redirectUrl: string;
  mockMode: boolean;
};

export function isShamCashMockMode(): boolean {
  const env = getServerEnv();
  return !env.SHAM_CASH_API_KEY || process.env.SHAM_CASH_MOCK === "true";
}

/**
 * Creates a Sham Cash payment session. Uses mock mode when SHAM_CASH_API_KEY is unset.
 * Replace the HTTP call with real Sham Cash API integration when credentials are available.
 */
export async function createShamCashSession(
  input: ShamCashSessionInput,
): Promise<ShamCashSessionResult> {
  const env = getServerEnv();
  const appUrl = env.APP_URL ?? "http://localhost:3000";

  if (isShamCashMockMode()) {
    const providerPaymentId = `mock_${input.orderId.replace(/-/g, "").slice(0, 24)}`;
    return {
      providerPaymentId,
      redirectUrl: `${appUrl}/checkout/mock-pay?orderId=${input.orderId}`,
      mockMode: true,
    };
  }

  throw new AppError(
    "Sham Cash API key is set but API client is not implemented yet",
    { code: "CONFIG", status: 503, expose: true },
  );
}

export function verifyShamCashWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
): boolean {
  const secret = getServerEnv().SHAM_CASH_WEBHOOK_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "development" || process.env.SHAM_CASH_MOCK === "true") {
      return true;
    }
    return false;
  }
  if (!signatureHeader) return false;
  const expected = createHash("sha256")
    .update(`${rawBody}${secret}`)
    .digest("hex");
  return expected === signatureHeader || signatureHeader === `sha256=${expected}`;
}
