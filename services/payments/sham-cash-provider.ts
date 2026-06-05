import "server-only";

import {
  createShamCashSession,
  getShamCashConfirmationMode,
  parseShamCashWebhookPayload,
  resolveShamCashMode,
  verifyShamCashWebhookSignature,
} from "@/services/sham-cash";
import type {
  PaymentConfirmationMode,
  PaymentProvider,
  PaymentProviderMode,
  PaymentSessionInput,
  PaymentSessionResult,
  ParsedWebhookPayload,
} from "@/services/payments/types";

export class ShamCashPaymentProvider implements PaymentProvider {
  readonly name = "sham_cash";

  get mode(): PaymentProviderMode {
    return resolveShamCashMode();
  }

  createSession(input: PaymentSessionInput): Promise<PaymentSessionResult> {
    return createShamCashSession(input);
  }

  verifyWebhookSignature(rawBody: string, signatureHeader: string | null): boolean {
    return verifyShamCashWebhookSignature(rawBody, signatureHeader);
  }

  parseWebhookPayload(rawBody: string): ParsedWebhookPayload {
    return parseShamCashWebhookPayload(rawBody);
  }
}

let cachedProvider: ShamCashPaymentProvider | null = null;

export function getPaymentProvider(): PaymentProvider {
  if (!cachedProvider) cachedProvider = new ShamCashPaymentProvider();
  return cachedProvider;
}

export function getPaymentConfirmationMode(): PaymentConfirmationMode {
  return getShamCashConfirmationMode();
}
