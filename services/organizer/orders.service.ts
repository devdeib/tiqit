import { AppError } from "@/lib/errors";
import type { OrganizerContext } from "@/lib/organizer-auth";
import { getOrganizerEvent } from "@/services/organizer/events.service";
import type { OrganizerOrderRow } from "@/types/organizer";

export async function listOrganizerEventOrders(
  ctx: OrganizerContext,
  eventId: string,
): Promise<OrganizerOrderRow[]> {
  await getOrganizerEvent(ctx, eventId);

  const { data: orders, error } = await ctx.supabase
    .from("orders")
    .select("id, status, total_amount, tickets_issued, created_at")
    .eq("event_id", eventId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new AppError("Failed to load orders", { code: "DATABASE", cause: error });
  }

  const rows: OrganizerOrderRow[] = [];
  for (const order of orders ?? []) {
    const [{ count: itemCount }, { count: ticketCount }] = await Promise.all([
      ctx.supabase
        .from("order_items")
        .select("id", { count: "exact", head: true })
        .eq("order_id", order.id),
      ctx.supabase
        .from("tickets")
        .select("id", { count: "exact", head: true })
        .eq("order_id", order.id),
    ]);

    rows.push({
      id: order.id,
      status: order.status,
      totalAmount: Number(order.total_amount),
      ticketsIssued: order.tickets_issued,
      createdAt: order.created_at,
      itemCount: itemCount ?? 0,
      ticketCount: ticketCount ?? 0,
    });
  }

  return rows;
}
