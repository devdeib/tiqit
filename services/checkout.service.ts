import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { AppError } from "@/lib/errors";
import { assertGuestOwnsOrder, assertGuestOwnsReservation } from "@/lib/guest-ownership";
import { getAppBaseUrl } from "@/lib/app-url";
import { logPaymentEvent } from "@/lib/observability/payment-log";
import {
  createShamCashSession,
  generatePaymentReferenceCode,
  isShamCashMockMode,
} from "@/services/sham-cash";
import { findPaymentTransaction } from "@/services/sham-cash/transaction-matcher";
import { processPaymentWebhook } from "@/services/fulfillment.service";
import { getReservation } from "@/services/reservations.service";
import type {
  CheckoutResponse,
  CheckoutStatusResponse,
  CheckoutVerifyPaymentResponse,
} from "@/types/api";

export async function createCheckout(input: {
  reservationId: string;
  idempotencyKey: string;
  phone: string;
}): Promise<CheckoutResponse> {
  const supabase = createAdminSupabaseClient();

  await assertGuestOwnsReservation(input.reservationId, input.phone);

  const existing = await supabase
    .from("orders")
    .select("id")
    .eq("idempotency_key", input.idempotencyKey)
    .maybeSingle();

  if (existing.data) {
    logPaymentEvent({ event: "checkout_resumed", orderId: existing.data.id });
    return resumeCheckout(existing.data.id, input.phone, input.reservationId);
  }

  const reservation = await getReservation(input.reservationId);

  if (reservation.status !== "pending") {
    throw new AppError("Reservation is no longer valid", {
      code: "CONFLICT",
      status: 409,
      expose: true,
    });
  }
  if (new Date(reservation.expires_at) <= new Date()) {
    throw new AppError("Reservation has expired", { code: "CONFLICT", status: 409, expose: true });
  }
  if (!reservation.inventory_held) {
    throw new AppError("Reservation has no inventory hold", {
      code: "CONFLICT",
      status: 409,
      expose: true,
    });
  }

  const { data: resItems, error: itemsError } = await supabase
    .from("reservation_items")
    .select("ticket_type_id, quantity")
    .eq("reservation_id", reservation.id);

  if (itemsError || !resItems?.length) {
    throw new AppError("Reservation has no items", { code: "DATABASE", cause: itemsError });
  }

  const typeIds = resItems.map((i) => i.ticket_type_id);
  const { data: types, error: typesError } = await supabase
    .from("ticket_types")
    .select("id, price")
    .in("id", typeIds);

  if (typesError) {
    throw new AppError("Failed to price order", { code: "DATABASE", cause: typesError });
  }

  const priceMap = new Map((types ?? []).map((t) => [t.id, Number(t.price)]));
  let totalAmount = 0;
  const orderItems = resItems.map((item) => {
    const unitPrice = priceMap.get(item.ticket_type_id) ?? 0;
    const lineTotal = unitPrice * item.quantity;
    totalAmount += lineTotal;
    return {
      ticket_type_id: item.ticket_type_id,
      quantity: item.quantity,
      unit_price: unitPrice,
      line_total: lineTotal,
    };
  });

  if (totalAmount <= 0) {
    throw new AppError("Invalid order total", { code: "VALIDATION_ERROR", status: 400, expose: true });
  }

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      customer_id: reservation.customer_id,
      reservation_id: reservation.id,
      event_id: reservation.event_id,
      total_amount: totalAmount,
      idempotency_key: input.idempotencyKey,
      status: "pending",
    })
    .select("id, total_amount")
    .single();

  if (orderError || !order) {
    if (orderError?.code === "23505") {
      const { data: byKey } = await supabase
        .from("orders")
        .select("id")
        .eq("idempotency_key", input.idempotencyKey)
        .maybeSingle();
      if (byKey) return resumeCheckout(byKey.id, input.phone, input.reservationId);

      const { data: byReservation } = await supabase
        .from("orders")
        .select("id")
        .eq("reservation_id", reservation.id)
        .maybeSingle();
      if (byReservation) {
        return resumeCheckout(byReservation.id, input.phone, input.reservationId);
      }
    }
    throw new AppError("Failed to create order", { code: "DATABASE", cause: orderError });
  }

  const { error: oiError } = await supabase.from("order_items").insert(
    orderItems.map((oi) => ({
      order_id: order.id,
      ticket_type_id: oi.ticket_type_id,
      quantity: oi.quantity,
      unit_price: oi.unit_price,
      line_total: oi.line_total,
    })),
  );

  if (oiError) {
    await supabase.from("orders").delete().eq("id", order.id);
    throw new AppError("Failed to create order items", { code: "DATABASE", cause: oiError });
  }

  const { data: guest } = await supabase
    .from("guest_customers")
    .select("phone")
    .eq("id", reservation.customer_id)
    .single();

  const referenceCode = generatePaymentReferenceCode();

  const session = await createShamCashSession({
    orderId: order.id,
    amount: Number(order.total_amount),
    currency: "SYP",
    customerPhone: guest?.phone ?? "",
    description: `Order ${order.id}`,
    referenceCode,
  });

  const providerPaymentId = session.mockMode ? session.providerPaymentId : referenceCode;

  const { data: payment, error: payError } = await supabase
    .from("payments")
    .insert({
      order_id: order.id,
      provider_payment_id: providerPaymentId,
      reference_code: referenceCode,
      amount: order.total_amount,
      currency: "SYP",
      status: "pending",
    })
    .select("id")
    .single();

  if (payError || !payment) {
    throw new AppError("Failed to create payment", { code: "DATABASE", cause: payError });
  }

  await supabase
    .from("orders")
    .update({ payment_reference_code: referenceCode })
    .eq("id", order.id);

  logPaymentEvent({
    event: "checkout_session_created",
    orderId: order.id,
    paymentId: payment.id,
    providerPaymentId,
    provider: "sham_cash",
    mode: session.mockMode ? "mock" : "live",
    amount: Number(order.total_amount),
    mockMode: session.mockMode,
  });

  return {
    orderId: order.id,
    paymentId: payment.id,
    totalAmount: Number(order.total_amount),
    redirectUrl: session.redirectUrl,
    mockMode: session.mockMode,
    referenceCode: session.mockMode ? undefined : referenceCode,
  };
}

async function resumeCheckout(
  orderId: string,
  phone: string,
  reservationId: string,
): Promise<CheckoutResponse> {
  await assertGuestOwnsOrder(orderId, phone);

  const supabase = createAdminSupabaseClient();
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("id, total_amount, status, reservation_id")
    .eq("id", orderId)
    .single();

  if (orderError || !order) {
    throw new AppError("Order not found", { code: "NOT_FOUND", status: 404, expose: true });
  }

  if (order.reservation_id !== reservationId) {
    throw new AppError("Checkout does not match this reservation", {
      code: "CONFLICT",
      status: 409,
      expose: true,
    });
  }

  if (order.status === "confirmed") {
    throw new AppError("Order is already paid", { code: "CONFLICT", status: 409, expose: true });
  }

  const { data: reservation } = await supabase
    .from("reservations")
    .select("status, expires_at, inventory_held")
    .eq("id", order.reservation_id)
    .single();

  if (
    !reservation ||
    reservation.status !== "pending" ||
    !reservation.inventory_held ||
    new Date(reservation.expires_at) <= new Date()
  ) {
    throw new AppError("Reservation has expired", { code: "CONFLICT", status: 409, expose: true });
  }

  const { data: pendingPayment } = await supabase
    .from("payments")
    .select("id, provider_payment_id, reference_code")
    .eq("order_id", orderId)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let paymentId = pendingPayment?.id ?? "";
  let providerPaymentId = pendingPayment?.provider_payment_id;
  let referenceCode = pendingPayment?.reference_code ?? undefined;

  if (!pendingPayment) {
    const { data: failedPayment } = await supabase
      .from("payments")
      .select("id, provider_payment_id")
      .eq("order_id", orderId)
      .eq("status", "failed")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (failedPayment) {
      const { data: reopened, error: reopenError } = await supabase
        .from("payments")
        .update({
          status: "pending",
          webhook_verified: false,
          webhook_received_at: null,
          raw_webhook_payload: null,
        })
        .eq("id", failedPayment.id)
        .eq("status", "failed")
        .select("id, provider_payment_id, reference_code")
        .single();

      if (reopenError || !reopened) {
        throw new AppError("Failed to reopen payment for retry", {
          code: "DATABASE",
          cause: reopenError,
        });
      }

      paymentId = reopened.id;
      providerPaymentId = reopened.provider_payment_id;
      referenceCode = reopened.reference_code ?? undefined;
    }
  }

  if (!paymentId) {
    const { data: guest } = await supabase
      .from("orders")
      .select("customer_id")
      .eq("id", orderId)
      .single();

    const { data: customer } = await supabase
      .from("guest_customers")
      .select("phone")
      .eq("id", guest?.customer_id ?? "")
      .maybeSingle();

    const newReferenceCode = generatePaymentReferenceCode();

    const session = await createShamCashSession({
      orderId: order.id,
      amount: Number(order.total_amount),
      currency: "SYP",
      customerPhone: customer?.phone ?? "",
      description: `Order ${order.id}`,
      referenceCode: newReferenceCode,
    });

    const providerId = session.mockMode ? session.providerPaymentId : newReferenceCode;

    const { data: created, error: payError } = await supabase
      .from("payments")
      .insert({
        order_id: order.id,
        provider_payment_id: providerId,
        reference_code: newReferenceCode,
        amount: order.total_amount,
        currency: "SYP",
        status: "pending",
      })
      .select("id, provider_payment_id, reference_code")
      .single();

    if (payError || !created) {
      if (payError?.code === "23505") {
        const { data: existingPayment } = await supabase
          .from("payments")
          .select("id, provider_payment_id, reference_code")
          .eq("provider_payment_id", providerId)
          .maybeSingle();
        if (existingPayment) {
          paymentId = existingPayment.id;
          providerPaymentId = existingPayment.provider_payment_id;
          referenceCode = existingPayment.reference_code ?? undefined;
        } else {
          throw new AppError("Failed to create payment for order", {
            code: "DATABASE",
            cause: payError,
          });
        }
      } else {
        throw new AppError("Failed to create payment for order", {
          code: "DATABASE",
          cause: payError,
        });
      }
    } else {
      paymentId = created.id;
      providerPaymentId = created.provider_payment_id;
      referenceCode = created.reference_code ?? newReferenceCode;

      await supabase
        .from("orders")
        .update({ payment_reference_code: referenceCode })
        .eq("id", order.id);
    }
  }

  const appUrl = getAppBaseUrl();
  const mockMode = providerPaymentId?.startsWith("mock_") ?? isShamCashMockMode();

  const redirectUrl = mockMode
    ? `${appUrl}/checkout/mock-pay?orderId=${orderId}`
    : buildLiveCheckoutRedirectUrl(orderId, referenceCode ?? "");

  return {
    orderId,
    paymentId,
    totalAmount: Number(order.total_amount),
    redirectUrl,
    mockMode,
    referenceCode: mockMode ? undefined : referenceCode,
  };
}

function buildLiveCheckoutRedirectUrl(orderId: string, referenceCode: string): string {
  const appUrl = getAppBaseUrl();
  const params = new URLSearchParams({ orderId });
  if (referenceCode) params.set("reference", referenceCode);
  return `${appUrl}/checkout/redirect?${params.toString()}`;
}

export async function getCheckoutStatus(
  orderId: string,
  phone: string,
): Promise<CheckoutStatusResponse> {
  await assertGuestOwnsOrder(orderId, phone);

  const supabase = createAdminSupabaseClient();

  const { data: order, error } = await supabase
    .from("orders")
    .select("id, status, tickets_issued")
    .eq("id", orderId)
    .maybeSingle();

  if (error || !order) {
    throw new AppError("Order not found", { code: "NOT_FOUND", status: 404, expose: true });
  }

  const { data: payments } = await supabase
    .from("payments")
    .select("status")
    .eq("order_id", orderId)
    .order("created_at", { ascending: false });

  let paymentStatus: CheckoutStatusResponse["paymentStatus"] = "pending";
  if (payments?.some((p) => p.status === "completed")) {
    paymentStatus = "completed";
  } else if (payments?.some((p) => p.status === "failed")) {
    paymentStatus = "failed";
  }

  const { count } = await supabase
    .from("tickets")
    .select("id", { count: "exact", head: true })
    .eq("order_id", orderId);

  return {
    orderId: order.id,
    orderStatus: order.status,
    paymentStatus,
    ticketsIssued: order.tickets_issued,
    ticketCount: count ?? 0,
  };
}

export async function verifyCheckoutPayment(
  orderId: string,
  phone: string,
): Promise<CheckoutVerifyPaymentResponse> {
  await assertGuestOwnsOrder(orderId, phone);

  if (isShamCashMockMode()) {
    throw new AppError("Mock checkout uses simulate-payment, not transaction verification", {
      code: "CONFLICT",
      status: 409,
      expose: true,
    });
  }

  const supabase = createAdminSupabaseClient();

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("id, status, total_amount")
    .eq("id", orderId)
    .maybeSingle();

  if (orderError || !order) {
    throw new AppError("Order not found", { code: "NOT_FOUND", status: 404, expose: true });
  }

  if (order.status === "confirmed") {
    const { data: completedPayment } = await supabase
      .from("payments")
      .select("provider_transaction_id, reference_code")
      .eq("order_id", orderId)
      .eq("status", "completed")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    return {
      orderId,
      verified: true,
      alreadyProcessed: true,
      referenceCode: completedPayment?.reference_code ?? undefined,
      transactionId: completedPayment?.provider_transaction_id ?? undefined,
    };
  }

  const { data: payment, error: paymentError } = await supabase
    .from("payments")
    .select("id, reference_code, amount, currency, status, provider_payment_id, created_at")
    .eq("order_id", orderId)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (paymentError) {
    throw new AppError("Failed to load payment", { code: "DATABASE", cause: paymentError });
  }

  if (!payment?.reference_code) {
    throw new AppError(
      "No pending payment with reference code for this order. Go back to checkout and click Pay again.",
      { code: "NOT_FOUND", status: 404, expose: true },
    );
  }

  const transaction = await findPaymentTransaction({
    id: payment.id,
    order_id: orderId,
    reference_code: payment.reference_code,
    amount: Number(payment.amount),
    currency: payment.currency,
    created_at: payment.created_at,
  });

  if (!transaction) {
    logPaymentEvent({
      event: "payment_verification_pending",
      orderId,
      paymentId: payment.id,
      provider: "sham_cash",
      mode: "live",
    });

    return {
      orderId,
      verified: false,
      referenceCode: payment.reference_code,
    };
  }

  const providerEventId = `txn:${transaction.transaction_id}`;
  const rawBody = JSON.stringify({
    event_id: providerEventId,
    payment_id: payment.provider_payment_id,
    order_id: orderId,
    status: "completed",
    amount: transaction.amount,
    transaction_id: transaction.transaction_id,
    reference_code: payment.reference_code,
    source: "transaction_verify",
  });

  const result = await processPaymentWebhook(
    {
      providerEventId,
      providerPaymentId: payment.provider_payment_id,
      orderId,
      status: "completed",
      amount: transaction.amount,
    },
    rawBody,
  );

  await supabase
    .from("payments")
    .update({ provider_transaction_id: transaction.transaction_id })
    .eq("id", payment.id)
    .is("provider_transaction_id", null);

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
    orderId: result.orderId,
    verified: true,
    alreadyProcessed: result.alreadyProcessed,
    referenceCode: payment.reference_code,
    transactionId: transaction.transaction_id,
  };
}
