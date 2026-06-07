import "server-only";

import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { AppError } from "@/lib/errors";
import { assertGuestOwnsOrder } from "@/lib/guest-ownership";
import { logPaymentEvent } from "@/lib/observability/payment-log";
import { buildPollWebhookPayload } from "@/services/sham-cash/poll-payload";
import { getPaymentConfirmationMode, getPaymentProvider } from "@/services/payments/sham-cash-provider";
import type { PaymentLifecycleStatus } from "@/services/payments/types";
import { processPaymentWebhook } from "@/services/fulfillment.service";

export type PollSyncResult =
  | { outcome: "skipped"; reason: string }
  | { outcome: "pending" }
  | { outcome: "failed"; orderId: string; alreadyProcessed: boolean }
  | { outcome: "fulfilled"; orderId: string; alreadyProcessed: boolean };

/**
 * Poll-based confirmation flow (api_poll mode):
 *
 *   pending payment in DB
 *     → provider.getPaymentStatus(providerPaymentId)
 *     → map provider response
 *     → processPaymentWebhook()
 *     → fulfill_payment_webhook() RPC (inside fulfillment service)
 *
 * Does not modify fulfillment logic — reuses existing webhook entrypoint.
 * Not wired to checkout routes in Phase 6.1 (Phase 6.3).
 */
export async function syncPendingPaymentFromProvider(
  orderId: string,
  phone: string,
): Promise<PollSyncResult> {
  const confirmationMode = getPaymentConfirmationMode();
  if (confirmationMode !== "api_poll") {
    return { outcome: "skipped", reason: `confirmation_mode_${confirmationMode}` };
  }

  await assertGuestOwnsOrder(orderId, phone);

  const supabase = createAdminSupabaseClient();
  const { data: payment, error } = await supabase
    .from("payments")
    .select("id, provider_payment_id, amount, status")
    .eq("order_id", orderId)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new AppError("Failed to load pending payment", { code: "DATABASE", cause: error });
  }

  if (!payment) {
    return { outcome: "skipped", reason: "no_pending_payment" };
  }

  const provider = getPaymentProvider();
  const statusResult = await provider.getPaymentStatus(payment.provider_payment_id);
  logPaymentEvent({
    event: "payment_status_polled",
    orderId,
    paymentId: payment.id,
    providerPaymentId: payment.provider_payment_id,
    provider: provider.name,
    mode: provider.mode,
  });

  const mapped = mapLifecycleToConfirmation(statusResult.status);
  if (!mapped) {
    return { outcome: "pending" };
  }

  const { payload, rawBody } = buildPollWebhookPayload({
    providerPaymentId: payment.provider_payment_id,
    status: mapped,
    amount: statusResult.amount ?? Number(payment.amount),
    orderId,
  });

  const result = await processPaymentWebhook(payload, rawBody);

  if (mapped === "failed") {
    return {
      outcome: "failed",
      orderId: result.orderId,
      alreadyProcessed: result.alreadyProcessed,
    };
  }

  return {
    outcome: "fulfilled",
    orderId: result.orderId,
    alreadyProcessed: result.alreadyProcessed,
  };
}

function mapLifecycleToConfirmation(
  status: PaymentLifecycleStatus,
): "completed" | "failed" | null {
  if (status === "completed") return "completed";
  if (status === "failed" || status === "cancelled") return "failed";
  return null;
}
