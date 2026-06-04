import { AppError } from "@/lib/errors";
import type { AdminContext } from "@/lib/admin-auth";
import type { AdminOrderInspection } from "@/types/admin";

export async function inspectAdminOrder(
  admin: AdminContext,
  orderId: string,
): Promise<AdminOrderInspection> {
  const { data: order, error: orderError } = await admin.supabase
    .from("orders")
    .select(
      "id, status, total_amount, tickets_issued, reservation_id, event_id, idempotency_key, created_at, updated_at, customer_id",
    )
    .eq("id", orderId)
    .maybeSingle();

  if (orderError || !order) {
    throw new AppError("Order not found", { code: "NOT_FOUND", status: 404, expose: true });
  }

  const [
    { data: guest },
    { data: reservation },
    { data: resItems },
    { data: payments },
    { data: orderItems },
    { data: tickets },
    { data: webhookEvents },
  ] = await Promise.all([
    admin.supabase
      .from("guest_customers")
      .select("id, full_name, phone, email")
      .eq("id", order.customer_id)
      .maybeSingle(),
    admin.supabase
      .from("reservations")
      .select("id, status, expires_at, inventory_held, created_at")
      .eq("id", order.reservation_id)
      .maybeSingle(),
    admin.supabase
      .from("reservation_items")
      .select("ticket_type_id, quantity")
      .eq("reservation_id", order.reservation_id),
    admin.supabase
      .from("payments")
      .select(
        "id, status, provider_payment_id, amount, webhook_verified, webhook_received_at, created_at",
      )
      .eq("order_id", orderId)
      .order("created_at", { ascending: true }),
    admin.supabase
      .from("order_items")
      .select("id, ticket_type_id, quantity, unit_price, line_total")
      .eq("order_id", orderId),
    admin.supabase
      .from("tickets")
      .select("id, status, ticket_type_id, holder_name, created_at")
      .eq("order_id", orderId),
    admin.supabase
      .from("payment_webhook_events")
      .select("provider_event_id, provider_payment_id, processed_at")
      .eq("order_id", orderId)
      .order("processed_at", { ascending: false })
      .limit(50),
  ]);

  return {
    order: {
      id: order.id,
      status: order.status,
      totalAmount: Number(order.total_amount),
      ticketsIssued: order.tickets_issued,
      reservationId: order.reservation_id,
      eventId: order.event_id,
      idempotencyKey: order.idempotency_key,
      createdAt: order.created_at,
      updatedAt: order.updated_at,
    },
    guest: guest
      ? {
          id: guest.id,
          fullName: guest.full_name,
          phone: guest.phone,
          email: guest.email,
        }
      : null,
    reservation: reservation
      ? {
          id: reservation.id,
          status: reservation.status,
          expiresAt: reservation.expires_at,
          inventoryHeld: reservation.inventory_held,
          createdAt: reservation.created_at,
          items: (resItems ?? []).map((i) => ({
            ticketTypeId: i.ticket_type_id,
            quantity: i.quantity,
          })),
        }
      : null,
    payments: (payments ?? []).map((p) => ({
      id: p.id,
      status: p.status,
      providerPaymentId: p.provider_payment_id,
      amount: Number(p.amount),
      webhookVerified: p.webhook_verified,
      webhookReceivedAt: p.webhook_received_at,
      createdAt: p.created_at,
    })),
    orderItems: (orderItems ?? []).map((i) => ({
      id: i.id,
      ticketTypeId: i.ticket_type_id,
      quantity: i.quantity,
      unitPrice: Number(i.unit_price),
      lineTotal: Number(i.line_total),
    })),
    tickets: (tickets ?? []).map((t) => ({
      id: t.id,
      status: t.status,
      ticketTypeId: t.ticket_type_id,
      holderName: t.holder_name,
      createdAt: t.created_at,
    })),
    webhookEvents: (webhookEvents ?? []).map((w) => ({
      providerEventId: w.provider_event_id,
      providerPaymentId: w.provider_payment_id,
      processedAt: w.processed_at,
    })),
  };
}
