import "server-only";

import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { AppError } from "@/lib/errors";
import { assertGuestOwnsOrder } from "@/lib/guest-ownership";
import { logPaymentEvent } from "@/lib/observability/payment-log";
import { uploadPaymentProofImage } from "@/lib/storage/payment-assets";
import { getPublicShamCashPaymentSettings } from "@/services/payment-settings.service";
import { processPaymentWebhook } from "@/services/fulfillment.service";
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

  const shamCash = await getPublicShamCashPaymentSettings();

  return {
    orderReferenceCode: payment?.reference_code ?? order.payment_reference_code ?? "",
    totalAmount: Number(order.total_amount),
    currency: payment?.currency ?? "SYP",
    orderStatus: order.status,
    paymentStatus: payment?.status ?? null,
    shamCash,
  };
}

export async function submitManualPaymentProof(input: {
  orderId: string;
  phone: string;
  transactionId: string;
  proofFile: File;
}): Promise<ManualPaymentSubmitResponse> {
  await assertGuestOwnsOrder(input.orderId, input.phone);

  const supabase = createAdminSupabaseClient();

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

  if (order.status === "payment_pending") {
    throw new AppError("Payment proof already submitted and awaiting review", {
      code: "CONFLICT",
      status: 409,
      expose: true,
    });
  }

  const { data: payment, error: paymentError } = await supabase
    .from("payments")
    .select("id, status, provider_payment_id, reference_code, amount")
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

  const proofImageUrl = await uploadPaymentProofImage(input.orderId, payment.id, input.proofFile);
  const submittedAt = new Date().toISOString();

  const { error: paymentUpdateError } = await supabase
    .from("payments")
    .update({
      status: "pending",
      payment_method: "sham_cash_manual",
      provider_transaction_id: input.transactionId.trim(),
      proof_image_url: proofImageUrl,
      submitted_at: submittedAt,
      verified_at: null,
      verified_by: null,
    })
    .eq("id", payment.id);

  if (paymentUpdateError) {
    throw new AppError("Failed to save payment proof", {
      code: "DATABASE",
      cause: paymentUpdateError,
    });
  }

  const { error: orderUpdateError } = await supabase
    .from("orders")
    .update({ status: "payment_pending" })
    .eq("id", input.orderId)
    .in("status", ["pending"]);

  if (orderUpdateError) {
    throw new AppError("Failed to update order status", {
      code: "DATABASE",
      cause: orderUpdateError,
    });
  }

  logPaymentEvent({
    event: "payment_proof_submitted",
    orderId: input.orderId,
    paymentId: payment.id,
    providerPaymentId: payment.provider_payment_id,
    provider: "sham_cash",
    mode: "live",
  });

  return {
    orderId: input.orderId,
    orderStatus: "payment_pending",
    referenceCode: payment.reference_code ?? "",
    submittedAt,
  };
}

export async function approveManualPayment(input: {
  paymentId: string;
  adminUserId: string;
}): Promise<{ orderId: string; alreadyProcessed: boolean }> {
  const supabase = createAdminSupabaseClient();

  const { data: payment, error } = await supabase
    .from("payments")
    .select(
      "id, order_id, status, provider_payment_id, provider_transaction_id, amount, proof_image_url, reference_code",
    )
    .eq("id", input.paymentId)
    .maybeSingle();

  if (error || !payment) {
    throw new AppError("Payment not found", { code: "NOT_FOUND", status: 404, expose: true });
  }

  if (!payment.proof_image_url) {
    throw new AppError("Payment has no submitted proof", {
      code: "VALIDATION_ERROR",
      status: 400,
      expose: true,
    });
  }

  if (payment.status === "completed") {
    return { orderId: payment.order_id, alreadyProcessed: true };
  }

  if (payment.status === "rejected") {
    throw new AppError("Cannot approve a rejected payment", {
      code: "CONFLICT",
      status: 409,
      expose: true,
    });
  }

  const providerEventId = `manual:${payment.id}:${input.adminUserId}`;
  const rawBody = JSON.stringify({
    event_id: providerEventId,
    payment_id: payment.provider_payment_id,
    order_id: payment.order_id,
    status: "completed",
    amount: Number(payment.amount),
    transaction_id: payment.provider_transaction_id,
    reference_code: payment.reference_code,
    proof_image_url: payment.proof_image_url,
    source: "manual_admin_approve",
  });

  const result = await processPaymentWebhook(
    {
      providerEventId,
      providerPaymentId: payment.provider_payment_id,
      orderId: payment.order_id,
      status: "completed",
      amount: Number(payment.amount),
    },
    rawBody,
  );

  await supabase
    .from("payments")
    .update({
      verified_at: new Date().toISOString(),
      verified_by: input.adminUserId,
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

  return { orderId: result.orderId, alreadyProcessed: result.alreadyProcessed };
}

export async function rejectManualPayment(input: {
  paymentId: string;
  adminUserId: string;
  reason?: string;
}): Promise<{ orderId: string }> {
  const supabase = createAdminSupabaseClient();

  const { data: payment, error } = await supabase
    .from("payments")
    .select("id, order_id, status")
    .eq("id", input.paymentId)
    .maybeSingle();

  if (error || !payment) {
    throw new AppError("Payment not found", { code: "NOT_FOUND", status: 404, expose: true });
  }

  if (payment.status === "completed") {
    throw new AppError("Cannot reject a completed payment", {
      code: "CONFLICT",
      status: 409,
      expose: true,
    });
  }

  const verifiedAt = new Date().toISOString();

  const { error: paymentUpdateError } = await supabase
    .from("payments")
    .update({
      status: "rejected",
      verified_at: verifiedAt,
      verified_by: input.adminUserId,
      raw_webhook_payload: input.reason ? { reject_reason: input.reason } : null,
    })
    .eq("id", payment.id);

  if (paymentUpdateError) {
    throw new AppError("Failed to reject payment", { code: "DATABASE", cause: paymentUpdateError });
  }

  await supabase
    .from("orders")
    .update({ status: "pending" })
    .eq("id", payment.order_id)
    .eq("status", "payment_pending");

  logPaymentEvent({
    event: "payment_failed",
    orderId: payment.order_id,
    paymentId: payment.id,
    provider: "sham_cash",
    mode: "live",
  });

  return { orderId: payment.order_id };
}
