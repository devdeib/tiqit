export type ShamCashSessionInput = {
  orderId: string;
  amount: number;
  currency: string;
  customerPhone: string;
  description: string;
  /** Guest-facing Sham Cash payment note (live mode). */
  referenceCode?: string;
};

export type ShamCashSessionResult = {
  providerPaymentId: string;
  redirectUrl: string;
  mockMode: boolean;
};

export type ShamCashPaymentStatusResult = {
  providerPaymentId: string;
  status: "pending" | "processing" | "completed" | "failed" | "cancelled";
  amount?: number;
  raw?: Record<string, unknown>;
};

export type ShamCashWebhookPayload = {
  event_id?: string;
  payment_id: string;
  order_id?: string;
  status: string;
  amount?: number;
};

export type PaymentProviderMode = "mock" | "live";

export interface ShamCashPaymentAdapter {
  readonly provider: "sham_cash";
  readonly mode: PaymentProviderMode;
  createSession(input: ShamCashSessionInput): Promise<ShamCashSessionResult>;
  getPaymentStatus(providerPaymentId: string): Promise<ShamCashPaymentStatusResult>;
  verifyWebhookSignature(rawBody: string, signatureHeader: string | null): boolean;
}
