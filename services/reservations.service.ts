import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { AppError } from "@/lib/errors";
import type { GuestInput, ReservationItemInput, ReservationResponse } from "@/types/api";

export async function createReservation(input: {
  eventId: string;
  items: ReservationItemInput[];
  guest: GuestInput;
}): Promise<ReservationResponse> {
  const supabase = createAdminSupabaseClient();

  const event = await getActiveEvent(input.eventId);

  const typeMap = await loadTicketTypes(input.eventId, input.items);

  const totalQty = input.items.reduce((s, i) => s + i.quantity, 0);
  if (totalQty > event.max_tickets_per_order) {
    throw new AppError(
      `Maximum ${event.max_tickets_per_order} tickets per order`,
      { code: "VALIDATION_ERROR", status: 400, expose: true },
    );
  }

  const { data: customerId, error: guestError } = await supabase.rpc("upsert_guest_customer", {
    p_phone: input.guest.phone,
    p_full_name: input.guest.fullName,
    p_email: input.guest.email ?? null,
  });

  if (guestError || !customerId) {
    throw new AppError("Failed to register guest", { code: "DATABASE", cause: guestError });
  }

  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  const { data: reservation, error: resError } = await supabase
    .from("reservations")
    .insert({
      customer_id: customerId,
      event_id: input.eventId,
      expires_at: expiresAt,
    })
    .select("id, event_id, expires_at")
    .single();

  if (resError || !reservation) {
    throw new AppError("Failed to create reservation", { code: "DATABASE", cause: resError });
  }

  const itemRows = input.items.map((item) => ({
    reservation_id: reservation.id,
    ticket_type_id: item.ticketTypeId,
    quantity: item.quantity,
  }));

  const { error: itemsError } = await supabase.from("reservation_items").insert(itemRows);
  if (itemsError) {
    await supabase.from("reservations").delete().eq("id", reservation.id);
    throw new AppError("Failed to add reservation items", {
      code: "DATABASE",
      cause: itemsError,
    });
  }

  const { error: invError } = await supabase.rpc("atomic_decrement_inventory", {
    p_reservation_id: reservation.id,
  });

  if (invError) {
    await supabase.from("reservations").delete().eq("id", reservation.id);
    const msg = invError.message ?? "Inventory unavailable";
    if (msg.includes("Insufficient") || msg.includes("not open")) {
      throw new AppError(msg, { code: "CONFLICT", status: 409, expose: true });
    }
    throw new AppError(msg, { code: "DATABASE", cause: invError });
  }

  let totalAmount = 0;
  const responseItems = input.items.map((item) => {
    const type = typeMap.get(item.ticketTypeId)!;
    const unitPrice = Number(type.price);
    const lineTotal = unitPrice * item.quantity;
    totalAmount += lineTotal;
    return {
      ticketTypeId: item.ticketTypeId,
      name: type.name,
      quantity: item.quantity,
      unitPrice,
      lineTotal,
    };
  });

  return {
    reservationId: reservation.id,
    eventId: reservation.event_id,
    expiresAt: reservation.expires_at,
    totalAmount,
    items: responseItems,
  };
}

export async function getReservation(reservationId: string) {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("reservations")
    .select("id, event_id, status, expires_at, inventory_held, customer_id")
    .eq("id", reservationId)
    .maybeSingle();

  if (error) {
    throw new AppError("Failed to load reservation", { code: "DATABASE", cause: error });
  }
  if (!data) {
    throw new AppError("Reservation not found", { code: "NOT_FOUND", status: 404, expose: true });
  }
  return data;
}

async function getActiveEvent(eventId: string) {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("events")
    .select("id, status, sale_ends_at, max_tickets_per_order")
    .eq("id", eventId)
    .eq("status", "active")
    .maybeSingle();

  if (error) {
    throw new AppError("Failed to verify event", { code: "DATABASE", cause: error });
  }
  if (!data) {
    throw new AppError("Event is not available for purchase", {
      code: "NOT_FOUND",
      status: 404,
      expose: true,
    });
  }
  if (new Date(data.sale_ends_at) <= new Date()) {
    throw new AppError("Ticket sales have ended", { code: "CONFLICT", status: 409, expose: true });
  }
  return data;
}

async function loadTicketTypes(eventId: string, items: ReservationItemInput[]) {
  const supabase = createAdminSupabaseClient();
  const ids = items.map((i) => i.ticketTypeId);
  const { data, error } = await supabase
    .from("ticket_types")
    .select("id, name, price, available, is_active, event_id")
    .in("id", ids)
    .eq("event_id", eventId)
    .eq("is_active", true);

  if (error) {
    throw new AppError("Failed to load ticket types", { code: "DATABASE", cause: error });
  }

  const map = new Map((data ?? []).map((t) => [t.id, t]));
  for (const item of items) {
    const type = map.get(item.ticketTypeId);
    if (!type) {
      throw new AppError("Invalid ticket type for this event", {
        code: "VALIDATION_ERROR",
        status: 400,
        expose: true,
      });
    }
    if (type.available < item.quantity) {
      throw new AppError(`Not enough ${type.name} tickets available`, {
        code: "CONFLICT",
        status: 409,
        expose: true,
      });
    }
  }
  return map;
}
