import { getAppBaseUrl } from "@/lib/app-url";
import { AppError } from "@/lib/errors";
import { shamCashSignatureMatches } from "@/services/sham-cash/signature";
import type {
  ShamCashPaymentAdapter,
  ShamCashSessionInput,
  ShamCashSessionResult,
} from "@/services/sham-cash/types";
import { getServerEnv } from "@/lib/env";

function buildLiveRedirectUrl(orderId: string, referenceCode: string): string {
  const appUrl = getAppBaseUrl();
  const params = new URLSearchParams({
    orderId,
    reference: referenceCode,
  });
  return `${appUrl}/checkout/redirect?${params.toString()}`;
}

/**
 * Live Sham Cash — no create-payment API. Guests pay manually with reference note;
 * confirmation uses GET /transactions via verify-payment.
 */
export class LiveShamCashAdapter implements ShamCashPaymentAdapter {
  readonly provider = "sham_cash" as const;
  readonly mode = "live" as const;

  async createSession(input: ShamCashSessionInput): Promise<ShamCashSessionResult> {
    if (!input.referenceCode) {
      throw new AppError("Payment reference code is required for live checkout", {
        code: "CONFIG",
        status: 503,
        expose: true,
      });
    }

    return {
      providerPaymentId: input.referenceCode,
      redirectUrl: buildLiveRedirectUrl(input.orderId, input.referenceCode),
      mockMode: false,
    };
  }

  async getPaymentStatus(providerPaymentId: string) {
    return {
      providerPaymentId,
      status: "pending" as const,
    };
  }

  verifyWebhookSignature(rawBody: string, signatureHeader: string | null): boolean {
    const secret = getServerEnv().SHAM_CASH_WEBHOOK_SECRET;
    if (!secret || !signatureHeader) return false;
    return shamCashSignatureMatches(rawBody, secret, signatureHeader);
  }
}
