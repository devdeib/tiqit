import { getAppBaseUrl } from "@/lib/app-url";
import { getAppEnvironment, getServerEnv } from "@/lib/env";
import { shamCashSignatureMatches } from "@/services/sham-cash/signature";
import type {
  ShamCashPaymentAdapter,
  ShamCashSessionInput,
  ShamCashSessionResult,
} from "@/services/sham-cash/types";

export class MockShamCashAdapter implements ShamCashPaymentAdapter {
  readonly provider = "sham_cash" as const;
  readonly mode = "mock" as const;

  async createSession(input: ShamCashSessionInput): Promise<ShamCashSessionResult> {
    const appUrl = getAppBaseUrl();
    const providerPaymentId = `mock_${input.orderId.replace(/-/g, "").slice(0, 24)}`;
    return {
      providerPaymentId,
      redirectUrl: `${appUrl}/checkout/mock-pay?orderId=${input.orderId}`,
      mockMode: true,
    };
  }

  verifyWebhookSignature(rawBody: string, signatureHeader: string | null): boolean {
    const secret = getServerEnv().SHAM_CASH_WEBHOOK_SECRET;
    if (secret && signatureHeader) {
      return shamCashSignatureMatches(rawBody, secret, signatureHeader);
    }
    const appEnv = getAppEnvironment();
    return appEnv === "development" || appEnv === "staging";
  }
}
