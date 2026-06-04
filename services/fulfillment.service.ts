import { createHash } from "crypto";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { AppError } from "@/lib/errors";
import {
  buildQrPayload,
  generateTicketToken,
  signTicketToken,
} from "@/lib/crypto/ticket-token";
import { assertGuestOwnsOrder } from "@/lib/guest-ownership";
import { logger } from "@/lib/logger";
import type { OrderConfirmationResponse } from "@/types/api";
import type { Json } from "@/types/database";

export type WebhookPayload = {
  providerEventId: string;
  providerPaymentId: string;
  /** Ignored for fulfillment; order is resolved from the payment row. */
  orderId?: string;
  status: "completed" | "failed";
  amount?: number;
};

type FulfillRpcResult = {
  already_processed: boolean;
  order_id: string;
};

type TicketInsertPayload = {
  order_item_id: string;
  ticket_type_id: string;
  token: string;
  hmac_signature: string;
  hmac_key_version: number;
  holder_name: string;
  holder_phone: string;
};

export async function processPaymentWebhook(
  payload: WebhookPayload,
  rawBody: string,
): Promise<{ ok: true; orderId: string; alreadyProcessed: boolean }> {
  const payloadHash = createHash("sha256").update(rawBody).digest("hex");

  if (payload.status !== "completed") {
    return processFailedPaymentWebhook(payload, payloadHash);
  }

  const payment = await loadPayment(payload.providerPaymentId);
  const orderId = payment.order_id;

  if (payload.orderId && payload.orderId !== orderId) {
    throw new AppError("Webhook order_id does not match payment", {
      code: "VALIDATION_ERROR",
      status: 400,
      expose: true,
    });
  }

  const alreadyRecorded = await hasWebhookEvent(payload.providerEventId);
  if (alreadyRecorded) {
    return { ok: true, orderId, alreadyProcessed: true };
  }

  if (payment.status === "completed" && payment.webhook_verified) {
    await insertWebhookEvent({
      providerEventId: payload.providerEventId,
      providerPaymentId: payload.providerPaymentId,
      orderId,
      payloadHash,
    });
    return { ok: true, orderId, alreadyProcessed: true };
  }

  const order = await loadOrder(orderId);

  if (payload.amount !== undefined && Math.abs(payload.amount - Number(order.total_amount)) >= 0.01) {
    throw new AppError("Payment amount mismatch", {
      code: "VALIDATION_ERROR",
      status: 400,
      expose: true,
    });
  }

  const tickets = await buildTicketPayloads(orderId);
  const supabase = createAdminSupabaseClient();

  const { data, error } = await supabase.rpc("fulfill_payment_webhook", {
    p_provider_payment_id: payload.providerPaymentId,
    p_provider_event_id: payload.providerEventId,
    p_payload_hash: payloadHash,
    p_raw_payload: JSON.parse(rawBody) as Json,
    p_tickets: tickets as unknown as Json,
    p_amount: payload.amount ?? null,
  });

  if (error) {
    if (error.message?.includes("reservation_not_eligible_for_payment")) {
      throw new AppError("Reservation expired or inventory was released", {
        code: "CONFLICT",
        status: 409,
        expose: true,
      });
    }
    throw new AppError("Payment fulfillment failed", { code: "DATABASE", cause: error });
  }

  const result = data as FulfillRpcResult;
  logger.info("Payment fulfilled", {
    orderId: result.order_id,
    providerPaymentId: payload.providerPaymentId,
    alreadyProcessed: result.already_processed,
  });

  return {
    ok: true,
    orderId: result.order_id,
    alreadyProcessed: result.already_processed,
  };
}

export async function simulateMockPayment(orderId: string, phone: string): Promise<void> {
  await assertGuestOwnsOrder(orderId, phone);

  const supabase = createAdminSupabaseClient();
  const { data: order } = await supabase
    .from("orders")
    .select("id, status")
    .eq("id", orderId)
    .maybeSingle();

  if (!order) {
    throw new AppError("Order not found", { code: "NOT_FOUND", status: 404, expose: true });
  }

  const { data: completed } = await supabase
    .from("payments")
    .select("id")
    .eq("order_id", orderId)
    .eq("status", "completed")
    .maybeSingle();

  if (completed || order.status === "confirmed") {
    throw new AppError("Payment already completed for this order", {
      code: "CONFLICT",
      status: 409,
      expose: true,
    });
  }

  const { data: payment } = await supabase
    .from("payments")
    .select("provider_payment_id, amount")
    .eq("order_id", orderId)
    .eq("status", "pending")
    .maybeSingle();

  if (!payment) {
    throw new AppError(
      "No pending payment for this order. Go back to checkout and click Pay again.",
      { code: "NOT_FOUND", status: 404, expose: true },
    );
  }

  const body = JSON.stringify({
    event_id: `mock_evt_${orderId}`,
    payment_id: payment.provider_payment_id,
    status: "completed",
    amount: payment.amount,
  });

  await processPaymentWebhook(
    {
      providerEventId: `mock_evt_${orderId}`,
      providerPaymentId: payment.provider_payment_id,
      status: "completed",
      amount: Number(payment.amount),
    },
    body,
  );
}

export async function getOrderConfirmation(
  orderId: string,
  phone: string,
): Promise<OrderConfirmationResponse> {
  await assertGuestOwnsOrder(orderId, phone);

  const supabase = createAdminSupabaseClient();

  const { data: order, error } = await supabase
    .from("orders")
    .select("id, event_id, total_amount, status, customer_id")
    .eq("id", orderId)
    .maybeSingle();

  if (error || !order) {
    throw new AppError("Order not found", { code: "NOT_FOUND", status: 404, expose: true });
  }

  const { data: event } = await supabase
    .from("events")
    .select("title")
    .eq("id", order.event_id)
    .single();

  const { data: tickets } = await supabase
    .from("tickets")
    .select("id, token, hmac_signature, hmac_key_version, holder_name, ticket_type_id")
    .eq("order_id", orderId);

  const typeIds = [...new Set((tickets ?? []).map((t) => t.ticket_type_id))];
  const { data: types } = await supabase
    .from("ticket_types")
    .select("id, name")
    .in("id", typeIds);

  const typeNames = new Map((types ?? []).map((t) => [t.id, t.name]));

  return {
    orderId: order.id,
    eventId: order.event_id,
    eventTitle: event?.title ?? "",
    totalAmount: Number(order.total_amount),
    status: order.status,
    tickets: (tickets ?? []).map((t) => ({
      id: t.id,
      token: t.token,
      qrPayload: buildQrPayload(t.token, t.hmac_signature, t.hmac_key_version),
      holderName: t.holder_name,
      ticketTypeName: typeNames.get(t.ticket_type_id) ?? "",
    })),
  };
}

async function buildTicketPayloads(orderId: string): Promise<TicketInsertPayload[]> {
  const supabase = createAdminSupabaseClient();

  const { data: order } = await supabase
    .from("orders")
    .select("id, customer_id, event_id, tickets_issued")
    .eq("id", orderId)
    .single();

  if (!order || order.tickets_issued) {
    throw new AppError("Tickets already issued or order missing", {
      code: "CONFLICT",
      status: 409,
      expose: true,
    });
  }

  const { data: guest } = await supabase
    .from("guest_customers")
    .select("full_name, phone")
    .eq("id", order.customer_id)
    .single();

  const { data: items } = await supabase
    .from("order_items")
    .select("id, ticket_type_id, quantity")
    .eq("order_id", orderId);

  const { data: hmacVersion } = await supabase
    .from("hmac_key_versions")
    .select("version")
    .eq("is_current", true)
    .maybeSingle();

  const keyVersion = hmacVersion?.version ?? 1;
  const tickets: TicketInsertPayload[] = [];

  for (const item of items ?? []) {
    for (let i = 0; i < item.quantity; i++) {
      const token = generateTicketToken();
      tickets.push({
        order_item_id: item.id,
        ticket_type_id: item.ticket_type_id,
        token,
        hmac_signature: signTicketToken(token, keyVersion),
        hmac_key_version: keyVersion,
        holder_name: guest?.full_name ?? "",
        holder_phone: guest?.phone ?? "",
      });
    }
  }

  if (tickets.length === 0) {
    throw new AppError("Order has no items to issue", {
      code: "VALIDATION_ERROR",
      status: 400,
      expose: true,
    });
  }

  return tickets;
}

async function processFailedPaymentWebhook(
  payload: WebhookPayload,
  payloadHash: string,
): Promise<{ ok: true; orderId: string; alreadyProcessed: boolean }> {
  const payment = await loadPayment(payload.providerPaymentId);
  const orderId = payment.order_id;

  if (payload.orderId && payload.orderId !== orderId) {
    throw new AppError("Webhook order_id does not match payment", {
      code: "VALIDATION_ERROR",
      status: 400,
      expose: true,
    });
  }

  if (await hasWebhookEvent(payload.providerEventId)) {
    return { ok: true, orderId, alreadyProcessed: true };
  }

  const supabase = createAdminSupabaseClient();

  if (payment.status === "failed") {
    await insertWebhookEvent({
      providerEventId: payload.providerEventId,
      providerPaymentId: payload.providerPaymentId,
      orderId,
      payloadHash,
    });
    return { ok: true, orderId, alreadyProcessed: true };
  }

  if (payment.status === "completed") {
    throw new AppError("Cannot fail a completed payment", {
      code: "CONFLICT",
      status: 409,
      expose: true,
    });
  }

  const { data: updated, error } = await supabase
    .from("payments")
    .update({ status: "failed" })
    .eq("id", payment.id)
    .eq("status", "pending")
    .select("id");

  if (error) {
    throw new AppError("Failed to update payment", { code: "DATABASE", cause: error });
  }

  if (!updated?.length) {
    throw new AppError("Payment is not in a pending state", {
      code: "CONFLICT",
      status: 409,
      expose: true,
    });
  }

  await insertWebhookEvent({
    providerEventId: payload.providerEventId,
    providerPaymentId: payload.providerPaymentId,
    orderId,
    payloadHash,
  });

  return { ok: true, orderId, alreadyProcessed: false };
}

async function hasWebhookEvent(providerEventId: string): Promise<boolean> {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("payment_webhook_events")
    .select("id")
    .eq("provider", "sham_cash")
    .eq("provider_event_id", providerEventId)
    .maybeSingle();

  if (error) {
    throw new AppError("Webhook dedupe check failed", { code: "DATABASE", cause: error });
  }
  return data !== null;
}

async function insertWebhookEvent(input: {
  providerEventId: string;
  providerPaymentId: string;
  orderId: string;
  payloadHash: string;
}): Promise<void> {
  const supabase = createAdminSupabaseClient();
  const { error } = await supabase.from("payment_webhook_events").insert({
    provider: "sham_cash",
    provider_event_id: input.providerEventId,
    provider_payment_id: input.providerPaymentId,
    order_id: input.orderId,
    payload_hash: input.payloadHash,
  });

  if (error && error.code !== "23505") {
    throw new AppError("Webhook dedupe insert failed", { code: "DATABASE", cause: error });
  }
}

async function loadPayment(providerPaymentId: string) {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("payments")
    .select("id, order_id, amount, status, webhook_verified")
    .eq("provider_payment_id", providerPaymentId)
    .maybeSingle();

  if (error || !data) {
    throw new AppError("Payment not found", { code: "NOT_FOUND", status: 404, expose: true });
  }
  return data;
}

async function loadOrder(orderId: string) {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("orders")
    .select("id, reservation_id, total_amount, tickets_issued, customer_id, event_id, status")
    .eq("id", orderId)
    .maybeSingle();

  if (error || !data) {
    throw new AppError("Order not found", { code: "NOT_FOUND", status: 404, expose: true });
  }
  return data;
}
