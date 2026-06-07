import "server-only";

import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { AppError } from "@/lib/errors";
import { assertGuestOwnsOrder } from "@/lib/guest-ownership";
import { logPaymentEvent } from "@/lib/observability/payment-log";
import { uploadPaymentProofImage } from "@/lib/storage/payment-assets";
import { processPaymentWebhook } from "@/services/fulfillment.service";
import { getPlatformPaymentSettings } from "@/services/payment-settings.service";
import {
  verifySubmittedTransaction,
} from "@/services/sham-cash/transaction-verifier";
import type { ManualPaymentSubmitResponse, PublicShamCashPaymentSettings } from "@/types/api";

export async function getManualPaymentCheckoutContext(orderId: string, phone: string): Promise<{
  orderReferenceCode: string;
  totalAmount: number;
  currency: string;
  orderStatus: string;
  paymentStatus: string | null;
  shamCash: PublicShamCashPaymentSettings;
}> {
  await assertGuestOwnsOrder(orderId, phone);

  const supabase = createAdminSupabaseClient();
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("id, total_amount, status, payment_reference_code")
    .eq("id", orderId)
    .maybeSingle();

  if (orderError || !order) {
    throw new AppError("Order not found", { code: "NOT_FOUND", status: 404, expose: true });
  }

  const { data: payment } = await supabase
    .from("payments")
    .select("reference_code, status, currency")
    .eq("order_id", orderId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const settings = await getPlatformPaymentSettings();

  return {
    orderReferenceCode: payment?.reference_code ?? order.payment_reference_code ?? "",
    totalAmount: Number(order.total_amount),
    currency: payment?.currency ?? "SYP",
    orderStatus: order.status,
    paymentStatus: payment?.status ?? null,
    shamCash: {
      accountId: settings.sham_cash_account_id,
      accountName: settings.sham_cash_account_name,
      qrImageUrl: settings.sham_cash_qr_image_url,
      instructions: settings.payment_instructions,
    },
  };
}

export async function submitManualPaymentProof(input: {
  orderId: string;
  phone: string;
  transactionId: string;
  proofFile?: File | null;
}): Promise<ManualPaymentSubmitResponse> {
  await assertGuestOwnsOrder(input.orderId, input.phone);

  const supabase = createAdminSupabaseClient();
  const transactionId = input.transactionId.trim();

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("id, status, total_amount")
    .eq("id", input.orderId)
    .maybeSingle();

  if (orderError || !order) {
    throw new AppError("Order not found", { code: "NOT_FOUND", status: 404, expose: true });
  }

  if (order.status === "confirmed") {
    throw new AppError("Order is already confirmed", { code: "CONFLICT", status: 409, expose: true });
  }

  const { data: payment, error: paymentError } = await supabase
    .from("payments")
    .select("id, status, provider_payment_id, reference_code, amount, currency, created_at")
    .eq("order_id", input.orderId)
    .in("status", ["pending", "rejected"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (paymentError) {
    throw new AppError("Failed to load payment", { code: "DATABASE", cause: paymentError });
  }

  if (!payment) {
    throw new AppError("No pending payment for this order", {
      code: "NOT_FOUND",
      status: 404,
      expose: true,
    });
  }

  const { data: existingUse } = await supabase
    .from("payments")
    .select("id, order_id")
    .eq("provider_transaction_id", transactionId)
    .neq("id", payment.id)
    .maybeSingle();

  if (existingUse) {
    return buildVerificationFailureResponse(input.orderId, payment.reference_code ?? "", {
      ok: false,
      reason: "This transaction ID has already been used for another order.",
    });
  }

  const settings = await getPlatformPaymentSettings();
  if (!settings.sham_cash_account_id.trim()) {
    throw new AppError("Sham Cash account is not configured", {
      code: "CONFIG",
      status: 503,
      expose: true,
    });
  }

  const verification = await verifySubmittedTransaction({
    transactionId,
    expectedAmount: Number(payment.amount),
    expectedCurrency: payment.currency,
    tiqitAccountId: settings.sham_cash_account_id,
    configuredApiAccountId: settings.sham_cash_api_account_id,
    paymentCreatedAt: payment.created_at,
  });

  let proofImageUrl: string | null = null;
  if (input.proofFile && input.proofFile.size > 0) {
    proofImageUrl = await uploadPaymentProofImage(input.orderId, payment.id, input.proofFile);
  }

  const submittedAt = new Date().toISOString();

  if (!verification.ok) {
    const { error: failedUpdateError } = await supabase
      .from("payments")
      .update({
        status: "pending",
        payment_method: "sham_cash_manual",
        provider_transaction_id: transactionId,
        proof_image_url: proofImageUrl,
        submitted_at: submittedAt,
        raw_webhook_payload: {
          verification_failed: true,
          reason: verification.reason,
          source: "transaction_verify_submit",
        },
      })
      .eq("id", payment.id);

    if (failedUpdateError) {
      // Guest still gets the verification reason even if optional audit columns are unavailable.
    }

    logPaymentEvent({
      event: "payment_verification_pending",
      orderId: input.orderId,
      paymentId: payment.id,
      providerPaymentId: payment.provider_payment_id,
      provider: "sham_cash",
      mode: "live",
    });

    return buildVerificationFailureResponse(
      input.orderId,
      payment.reference_code ?? "",
      verification,
    );
  }

  const providerEventId = `txn:${verification.transaction.transaction_id}`;
  const rawBody = JSON.stringify({
    event_id: providerEventId,
    payment_id: payment.provider_payment_id,
    order_id: input.orderId,
    status: "completed",
    amount: verification.transaction.amount,
    transaction_id: verification.transaction.transaction_id,
    reference_code: payment.reference_code,
    receiver_account: verification.transaction.receiver_account,
    source: "transaction_verify_submit",
  });

  const result = await processPaymentWebhook(
    {
      providerEventId,
      providerPaymentId: payment.provider_payment_id,
      orderId: input.orderId,
      status: "completed",
      amount: verification.transaction.amount,
    },
    rawBody,
  ).catch((err) => {
    if (err instanceof AppError && err.expose) throw err;
    throw new AppError("Payment was verified but ticket issuance failed. Contact support.", {
      code: "INTERNAL",
      status: 500,
      expose: true,
      cause: err,
    });
  });

  await supabase
    .from("payments")
    .update({
      provider_transaction_id: verification.transaction.transaction_id,
      proof_image_url: proofImageUrl,
      submitted_at: submittedAt,
      verified_at: submittedAt,
      verified_by: null,
      payment_method: "sham_cash_manual",
      raw_webhook_payload: {
        verification_failed: false,
        source: "transaction_verify_submit",
      },
    })
    .eq("id", payment.id);

  logPaymentEvent({
    event: result.alreadyProcessed ? "payment_duplicate_webhook" : "payment_verified",
    orderId: result.orderId,
    paymentId: payment.id,
    providerPaymentId: payment.provider_payment_id,
    provider: "sham_cash",
    mode: "live",
    alreadyProcessed: result.alreadyProcessed,
  });

  return {
    orderId: input.orderId,
    verified: true,
    orderStatus: "confirmed",
    referenceCode: payment.reference_code ?? "",
    submittedAt,
  };
}

function buildVerificationFailureResponse(
  orderId: string,
  referenceCode: string,
  verification: { ok: false; reason: string },
): ManualPaymentSubmitResponse {
  return {
    orderId,
    verified: false,
    orderStatus: "pending",
    referenceCode,
    verificationMessage: verification.reason,
  };
}
