import { getServerEnv } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { shamCashSignatureMatches } from "@/services/sham-cash/signature";
import type {
  ShamCashPaymentAdapter,
  ShamCashSessionInput,
  ShamCashSessionResult,
} from "@/services/sham-cash/types";

/**
 * Live Sham Cash integration (API-key-only provider).
 * Implement createSession (checkout redirect) and payment status polling with SHAM_CASH_API_KEY.
 * Webhooks are optional — set SHAM_CASH_WEBHOOK_SECRET only if Sham Cash sends signed callbacks.
 */
export class LiveShamCashAdapter implements ShamCashPaymentAdapter {
  readonly provider = "sham_cash" as const;
  readonly mode = "live" as const;

  async createSession(_input: ShamCashSessionInput): Promise<ShamCashSessionResult> {
    const env = getServerEnv();
    if (!env.SHAM_CASH_API_KEY) {
      throw new AppError("SHAM_CASH_API_KEY is not configured", {
        code: "CONFIG",
        status: 503,
        expose: true,
      });
    }

    // TODO(Phase 1+): POST to `${env.SHAM_CASH_API_BASE_URL}/payments` (or provider path)
    // and map response to providerPaymentId + redirectUrl.
    throw new AppError(
      "Sham Cash live adapter is not implemented — add API mapping in live-adapter.ts",
      { code: "CONFIG", status: 503, expose: true },
    );
  }

  verifyWebhookSignature(rawBody: string, signatureHeader: string | null): boolean {
    const secret = getServerEnv().SHAM_CASH_WEBHOOK_SECRET;
    if (!secret || !signatureHeader) return false;
    return shamCashSignatureMatches(rawBody, secret, signatureHeader);
  }
}
