import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { AppError } from "@/lib/errors";
import { adminIssueTicketsForOrder } from "@/services/fulfillment.service";

export async function inspectOrder(orderId: string) {
  const supabase = createAdminSupabaseClient();

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select(
      "id, status, total_amount, tickets_issued, reservation_id, event_id, customer_id, idempotency_key, created_at, updated_at",
    )
    .eq("id", orderId)
    .maybeSingle();

  if (orderError || !order) {
    throw new AppError("Order not found", { code: "NOT_FOUND", status: 404, expose: true });
  }

  const [
    { data: guest },
    { data: reservation },
    { data: payments },
    { data: orderItems },
    { data: tickets },
    { data: webhookEvents },
  ] = await Promise.all([
    supabase.from("guest_customers").select("id, full_name, phone, email").eq("id", order.customer_id).maybeSingle(),
    supabase
      .from("reservations")
      .select("id, status, expires_at, inventory_held, created_at")
      .eq("id", order.reservation_id)
      .maybeSingle(),
    supabase
      .from("payments")
      .select("id, status, provider_payment_id, amount, webhook_verified, created_at, updated_at")
      .eq("order_id", orderId)
      .order("created_at", { ascending: true }),
    supabase.from("order_items").select("id, ticket_type_id, quantity, unit_price, line_total").eq("order_id", orderId),
    supabase
      .from("tickets")
      .select("id, status, ticket_type_id, holder_name, created_at")
      .eq("order_id", orderId),
    supabase
      .from("payment_webhook_events")
      .select("provider_event_id, provider_payment_id, processed_at")
      .eq("order_id", orderId)
      .order("processed_at", { ascending: false })
      .limit(20),
  ]);

  return {
    order,
    guest: guest ?? null,
    reservation: reservation ?? null,
    payments: payments ?? [],
    orderItems: orderItems ?? [],
    tickets: tickets ?? [],
    webhookEvents: webhookEvents ?? [],
  };
}

export async function resendTicketsForOrder(orderId: string) {
  const supabase = createAdminSupabaseClient();
  const { data: order } = await supabase
    .from("orders")
    .select("id, status, tickets_issued")
    .eq("id", orderId)
    .maybeSingle();

  if (!order) {
    throw new AppError("Order not found", { code: "NOT_FOUND", status: 404, expose: true });
  }

  if (order.status !== "confirmed") {
    throw new AppError("Order must be confirmed before issuing tickets", {
      code: "CONFLICT",
      status: 409,
      expose: true,
    });
  }

  const { count } = await supabase
    .from("tickets")
    .select("id", { count: "exact", head: true })
    .eq("order_id", orderId);

  if (order.tickets_issued && (count ?? 0) > 0) {
    throw new AppError("Tickets already issued for this order", {
      code: "CONFLICT",
      status: 409,
      expose: true,
      details: { ticketCount: count ?? 0 },
    });
  }

  const issued = await adminIssueTicketsForOrder(orderId);
  return { orderId, ticketsIssued: issued };
}

export async function forceReleaseReservation(reservationId: string) {
  const supabase = createAdminSupabaseClient();

  const { data: reservation, error } = await supabase
    .from("reservations")
    .select("id, status, inventory_held")
    .eq("id", reservationId)
    .maybeSingle();

  if (error || !reservation) {
    throw new AppError("Reservation not found", { code: "NOT_FOUND", status: 404, expose: true });
  }

  if (reservation.status === "converted") {
    throw new AppError("Cannot release a converted reservation", {
      code: "CONFLICT",
      status: 409,
      expose: true,
    });
  }

  const { error: rpcError } = await supabase.rpc("release_reservation_inventory", {
    p_reservation_id: reservationId,
  });

  if (rpcError) {
    throw new AppError("Failed to release reservation inventory", {
      code: "DATABASE",
      cause: rpcError,
    });
  }

  if (reservation.status === "pending") {
    await supabase.from("reservations").update({ status: "expired" }).eq("id", reservationId);
  }

  return {
    reservationId,
    released: true,
    status: reservation.status === "pending" ? "expired" : reservation.status,
  };
}
