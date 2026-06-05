/**
 * Provider-agnostic payment types for Phase 5.
 * Sham Cash is the current implementation; live API mapping is pending documentation.
 */

export type PaymentProviderMode = "mock" | "live";

export type PaymentLifecycleStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed"
  | "cancelled";

export type PaymentConfirmationMode = "mock" | "webhook" | "api_poll";

export type PaymentSessionInput = {
  orderId: string;
  amount: number;
  currency: string;
  customerPhone: string;
  description: string;
};

export type PaymentSessionResult = {
  providerPaymentId: string;
  redirectUrl: string;
  mockMode: boolean;
};

export type PaymentStatusResult = {
  providerPaymentId: string;
  status: PaymentLifecycleStatus;
  amount?: number;
  raw?: Record<string, unknown>;
};

export type ParsedWebhookPayload = {
  providerEventId: string;
  providerPaymentId: string;
  orderId?: string;
  status: "completed" | "failed";
  amount?: number;
};

export interface PaymentProvider {
  readonly name: string;
  readonly mode: PaymentProviderMode;
  createSession(input: PaymentSessionInput): Promise<PaymentSessionResult>;
  verifyWebhookSignature(rawBody: string, signatureHeader: string | null): boolean;
  parseWebhookPayload(rawBody: string): ParsedWebhookPayload;
  /** Optional — required when confirmation mode is api_poll */
  getPaymentStatus?(providerPaymentId: string): Promise<PaymentStatusResult>;
}
