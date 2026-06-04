import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { AppError } from "@/lib/errors";
import { assertGuestOwnsOrder, assertGuestOwnsReservation } from "@/lib/guest-ownership";
import { getAppBaseUrl } from "@/lib/app-url";
import { createShamCashSession, isShamCashMockMode } from "@/services/sham-cash";
import { getReservation } from "@/services/reservations.service";
import type { CheckoutResponse, CheckoutStatusResponse } from "@/types/api";

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
    return resumeCheckout(existing.data.id, input.phone);
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
      const dup = await supabase
        .from("orders")
        .select("id")
        .eq("idempotency_key", input.idempotencyKey)
        .single();
      if (dup.data) return resumeCheckout(dup.data.id, input.phone);
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

  const session = await createShamCashSession({
    orderId: order.id,
    amount: Number(order.total_amount),
    currency: "SYP",
    customerPhone: guest?.phone ?? "",
    description: `Order ${order.id}`,
  });

  const { data: payment, error: payError } = await supabase
    .from("payments")
    .insert({
      order_id: order.id,
      provider_payment_id: session.providerPaymentId,
      amount: order.total_amount,
      status: "pending",
    })
    .select("id")
    .single();

  if (payError || !payment) {
    throw new AppError("Failed to create payment", { code: "DATABASE", cause: payError });
  }

  return {
    orderId: order.id,
    paymentId: payment.id,
    totalAmount: Number(order.total_amount),
    redirectUrl: session.redirectUrl,
    mockMode: session.mockMode,
  };
}

async function resumeCheckout(orderId: string, phone: string): Promise<CheckoutResponse> {
  await assertGuestOwnsOrder(orderId, phone);

  const supabase = createAdminSupabaseClient();
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("id, total_amount, status")
    .eq("id", orderId)
    .single();

  if (orderError || !order) {
    throw new AppError("Order not found", { code: "NOT_FOUND", status: 404, expose: true });
  }

  if (order.status === "confirmed") {
    throw new AppError("Order is already paid", { code: "CONFLICT", status: 409, expose: true });
  }

  const { data: pendingPayment } = await supabase
    .from("payments")
    .select("id, provider_payment_id")
    .eq("order_id", orderId)
    .eq("status", "pending")
    .maybeSingle();

  let paymentId = pendingPayment?.id ?? "";
  let providerPaymentId = pendingPayment?.provider_payment_id;

  if (!pendingPayment) {
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

    const session = await createShamCashSession({
      orderId: order.id,
      amount: Number(order.total_amount),
      currency: "SYP",
      customerPhone: customer?.phone ?? "",
      description: `Order ${order.id}`,
    });

    const { data: created, error: payError } = await supabase
      .from("payments")
      .insert({
        order_id: order.id,
        provider_payment_id: session.providerPaymentId,
        amount: order.total_amount,
        status: "pending",
      })
      .select("id, provider_payment_id")
      .single();

    if (payError || !created) {
      throw new AppError("Failed to create payment for order", {
        code: "DATABASE",
        cause: payError,
      });
    }

    paymentId = created.id;
    providerPaymentId = created.provider_payment_id;
  }

  const appUrl = getAppBaseUrl();
  const mockMode = providerPaymentId?.startsWith("mock_") ?? isShamCashMockMode();

  return {
    orderId,
    paymentId,
    totalAmount: Number(order.total_amount),
    redirectUrl: mockMode
      ? `${appUrl}/checkout/mock-pay?orderId=${orderId}`
      : `${appUrl}/checkout/redirect?orderId=${orderId}`,
    mockMode,
  };
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

  const { data: payment } = await supabase
    .from("payments")
    .select("status")
    .eq("order_id", orderId)
    .eq("status", "completed")
    .maybeSingle();

  const { count } = await supabase
    .from("tickets")
    .select("id", { count: "exact", head: true })
    .eq("order_id", orderId);

  return {
    orderId: order.id,
    orderStatus: order.status,
    paymentStatus: payment ? "completed" : "pending",
    ticketsIssued: order.tickets_issued,
    ticketCount: count ?? 0,
  };
}
