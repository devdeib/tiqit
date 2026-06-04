import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { AppError } from "@/lib/errors";
import type { PublicEventDetail, PublicEventSummary } from "@/types/api";

const PUBLIC_STATUSES = ["active", "sold_out", "completed", "cancelled"] as const;

export async function listPublicEvents(): Promise<PublicEventSummary[]> {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("events")
    .select("id, title, venue, event_date, sale_ends_at, status")
    .in("status", [...PUBLIC_STATUSES])
    .order("event_date", { ascending: true });

  if (error) {
    throw new AppError("Failed to load events", { code: "DATABASE", cause: error });
  }

  return (data ?? []).map((e) => ({
    id: e.id,
    title: e.title,
    venue: e.venue,
    eventDate: e.event_date,
    saleEndsAt: e.sale_ends_at,
    status: e.status,
  }));
}

export async function getPublicEvent(eventId: string): Promise<PublicEventDetail> {
  const supabase = createAdminSupabaseClient();

  const { data: event, error: eventError } = await supabase
    .from("events")
    .select(
      "id, title, description, venue, event_date, sale_ends_at, status, max_tickets_per_order",
    )
    .eq("id", eventId)
    .in("status", [...PUBLIC_STATUSES])
    .maybeSingle();

  if (eventError) {
    throw new AppError("Failed to load event", { code: "DATABASE", cause: eventError });
  }
  if (!event) {
    throw new AppError("Event not found", { code: "NOT_FOUND", status: 404, expose: true });
  }

  const { data: types, error: typesError } = await supabase
    .from("ticket_types")
    .select("id, name, description, price, available, is_active")
    .eq("event_id", eventId)
    .eq("is_active", true)
    .order("price", { ascending: true });

  if (typesError) {
    throw new AppError("Failed to load ticket types", { code: "DATABASE", cause: typesError });
  }

  return {
    id: event.id,
    title: event.title,
    description: event.description,
    venue: event.venue,
    eventDate: event.event_date,
    saleEndsAt: event.sale_ends_at,
    status: event.status,
    maxTicketsPerOrder: event.max_tickets_per_order,
    ticketTypes: (types ?? []).map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description,
      price: Number(t.price),
      available: t.available,
      isActive: t.is_active,
    })),
  };
}
