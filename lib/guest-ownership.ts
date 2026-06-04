import "server-only";

import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { AppError } from "@/lib/errors";

async function guestPhoneForCustomer(customerId: string): Promise<string | null> {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("guest_customers")
    .select("phone")
    .eq("id", customerId)
    .maybeSingle();

  if (error) {
    throw new AppError("Failed to verify guest", { code: "DATABASE", cause: error });
  }
  return data?.phone ?? null;
}

/** Returns generic not-found to avoid leaking resource existence. */
export async function assertGuestOwnsReservation(
  reservationId: string,
  phone: string,
): Promise<void> {
  const supabase = createAdminSupabaseClient();
  const { data: reservation, error } = await supabase
    .from("reservations")
    .select("customer_id")
    .eq("id", reservationId)
    .maybeSingle();

  if (error) {
    throw new AppError("Failed to load reservation", { code: "DATABASE", cause: error });
  }
  if (!reservation) {
    throw new AppError("Reservation not found", { code: "NOT_FOUND", status: 404, expose: true });
  }

  const guestPhone = await guestPhoneForCustomer(reservation.customer_id);
  if (guestPhone !== phone) {
    throw new AppError("Reservation not found", { code: "NOT_FOUND", status: 404, expose: true });
  }
}

export async function assertGuestOwnsOrder(orderId: string, phone: string): Promise<void> {
  const supabase = createAdminSupabaseClient();
  const { data: order, error } = await supabase
    .from("orders")
    .select("customer_id")
    .eq("id", orderId)
    .maybeSingle();

  if (error) {
    throw new AppError("Failed to load order", { code: "DATABASE", cause: error });
  }
  if (!order) {
    throw new AppError("Order not found", { code: "NOT_FOUND", status: 404, expose: true });
  }

  const guestPhone = await guestPhoneForCustomer(order.customer_id);
  if (guestPhone !== phone) {
    throw new AppError("Order not found", { code: "NOT_FOUND", status: 404, expose: true });
  }
}
