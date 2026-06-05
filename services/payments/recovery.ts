import type { PaymentLifecycleStatus } from "@/services/payments/types";

export type PaymentRecoveryContext = {
  orderId: string;
  paymentStatus: PaymentLifecycleStatus | "unknown";
  reservationExpired: boolean;
  ticketsIssued: boolean;
};

export type PaymentRecoveryAction =
  | "retry_checkout"
  | "wait_for_webhook"
  | "poll_provider"
  | "contact_support";

export type PaymentRecoveryPlan = {
  action: PaymentRecoveryAction;
  message: string;
};

/**
 * Maps payment state to a guest-safe recovery hint.
 * Does not mutate data — checkout resume/reopen logic stays in checkout.service.
 */
export function resolvePaymentRecoveryPlan(
  context: PaymentRecoveryContext,
): PaymentRecoveryPlan {
  if (context.ticketsIssued) {
    return {
      action: "contact_support",
      message: "Payment completed and tickets were issued.",
    };
  }

  if (context.reservationExpired) {
    return {
      action: "contact_support",
      message: "Reservation expired. Start a new booking.",
    };
  }

  if (context.paymentStatus === "failed") {
    return {
      action: "retry_checkout",
      message: "Payment failed. Return to checkout and try again.",
    };
  }

  if (context.paymentStatus === "pending" || context.paymentStatus === "processing") {
    return {
      action: "wait_for_webhook",
      message: "Payment is processing. Wait a moment or refresh the confirmation page.",
    };
  }

  return {
    action: "poll_provider",
    message: "Payment status unknown. Retry checkout or contact support.",
  };
}
