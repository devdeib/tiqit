import { AppError } from "@/lib/errors";
import type { OrganizerContext } from "@/lib/organizer-auth";
import { getOrganizerEvent } from "@/services/organizer/events.service";
import type { OrganizerEventAnalytics } from "@/types/organizer";

export async function getOrganizerEventAnalytics(
  ctx: OrganizerContext,
  eventId: string,
): Promise<OrganizerEventAnalytics> {
  await getOrganizerEvent(ctx, eventId);

  const { data: orders, error: ordersError } = await ctx.supabase
    .from("orders")
    .select("id, status, total_amount")
    .eq("event_id", eventId);

  if (ordersError) {
    throw new AppError("Failed to load analytics", { code: "DATABASE", cause: ordersError });
  }

  const confirmed = (orders ?? []).filter((o) => o.status === "confirmed");
  const revenueConfirmed = confirmed.reduce((s, o) => s + Number(o.total_amount), 0);

  const { count: ticketsSold, error: ticketsError } = await ctx.supabase
    .from("tickets")
    .select("id", { count: "exact", head: true })
    .eq("event_id", eventId);

  if (ticketsError) {
    throw new AppError("Failed to load ticket analytics", { code: "DATABASE", cause: ticketsError });
  }

  const { data: types, error: typesError } = await ctx.supabase
    .from("ticket_types")
    .select("id, name, total_capacity, available, price")
    .eq("event_id", eventId);

  if (typesError) {
    throw new AppError("Failed to load ticket type analytics", {
      code: "DATABASE",
      cause: typesError,
    });
  }

  const byTicketType = (types ?? []).map((t) => {
    const sold = t.total_capacity - t.available;
    return {
      ticketTypeId: t.id,
      name: t.name,
      sold,
      remaining: t.available,
      revenue: sold * Number(t.price),
    };
  });

  const ticketsRemaining = byTicketType.reduce((s, t) => s + t.remaining, 0);

  return {
    eventId,
    ordersTotal: orders?.length ?? 0,
    ordersConfirmed: confirmed.length,
    revenueConfirmed,
    ticketsSold: ticketsSold ?? 0,
    ticketsRemaining,
    byTicketType,
  };
}
