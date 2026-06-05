import "server-only";

import { logger } from "@/lib/logger";

export type PaymentLogEvent =
  | "checkout_started"
  | "checkout_session_created"
  | "checkout_resumed"
  | "payment_failed"
  | "payment_completed"
  | "payment_fulfilled"
  | "payment_duplicate_webhook";

export type PaymentLogContext = {
  event: PaymentLogEvent;
  requestId?: string;
  orderId?: string;
  paymentId?: string;
  providerPaymentId?: string;
  provider?: string;
  mode?: "mock" | "live";
  amount?: number;
  mockMode?: boolean;
  alreadyProcessed?: boolean;
  durationMs?: number;
  errorCode?: string;
};

export function logPaymentEvent(context: PaymentLogContext): void {
  logger.info("payment_lifecycle", context);
}
