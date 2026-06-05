import { AppError } from "@/lib/errors";
import { databaseAppError } from "@/lib/database-error";
import type { AdminContext } from "@/lib/admin-auth";
import type { AdminDashboardStats, AdminEventDetail, AdminPendingEvent } from "@/types/admin";
import { logAdminAction } from "@/services/admin/audit.service";

export async function getAdminDashboardStats(
  admin: AdminContext,
): Promise<AdminDashboardStats> {
  const [{ count: eventsPending }, { count: organizersPending }, stuckPayments] =
    await Promise.all([
      admin.supabase
        .from("events")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending_approval"),
      admin.supabase
        .from("users")
        .select("id", { count: "exact", head: true })
        .eq("role", "organizer")
        .eq("organizer_status", "pending"),
      countStuckPayments(admin),
    ]);

  return {
    eventsPendingApproval: eventsPending ?? 0,
    organizersPending: organizersPending ?? 0,
    stuckPayments,
  };
}

export async function listPendingEvents(
  admin: AdminContext,
): Promise<AdminPendingEvent[]> {
  const { data: events, error } = await admin.supabase
    .from("events")
    .select("id, title, venue, event_date, status, organizer_id, created_at")
    .eq("status", "pending_approval")
    .order("created_at", { ascending: true });

  if (error) {
    throw databaseAppError("Failed to load pending events", error);
  }

  const rows: AdminPendingEvent[] = [];
  for (const row of events ?? []) {
    const organizer = await loadOrganizerSummary(admin, row.organizer_id);
    rows.push({
      id: row.id,
      title: row.title,
      venue: row.venue,
      eventDate: row.event_date,
      status: row.status,
      organizerId: row.organizer_id,
      organizerName: organizer.name,
      organizerEmail: organizer.email,
      createdAt: row.created_at,
    });
  }
  return rows;
}

export async function getAdminEventDetail(
  admin: AdminContext,
  eventId: string,
): Promise<AdminEventDetail> {
  const { data: event, error } = await admin.supabase
    .from("events")
    .select(
      "id, title, description, venue, event_date, sale_ends_at, status, organizer_id, max_tickets_per_order, refund_policy_note, created_at",
    )
    .eq("id", eventId)
    .maybeSingle();

  if (error) {
    throw new AppError("Failed to load event", { code: "DATABASE", cause: error });
  }
  if (!event) {
    throw new AppError("Event not found", { code: "NOT_FOUND", status: 404, expose: true });
  }

  const { count: ticketTypeCount } = await admin.supabase
    .from("ticket_types")
    .select("id", { count: "exact", head: true })
    .eq("event_id", eventId);

  const organizer = await loadOrganizerSummary(admin, event.organizer_id);

  return {
    id: event.id,
    title: event.title,
    description: event.description,
    venue: event.venue,
    eventDate: event.event_date,
    saleEndsAt: event.sale_ends_at,
    status: event.status,
    organizerId: event.organizer_id,
    organizerName: organizer.name,
    organizerEmail: organizer.email,
    maxTicketsPerOrder: event.max_tickets_per_order,
    refundPolicyNote: event.refund_policy_note,
    ticketTypeCount: ticketTypeCount ?? 0,
    createdAt: event.created_at,
  };
}

export async function approveEvent(
  admin: AdminContext,
  eventId: string,
): Promise<AdminEventDetail> {
  const { data, error } = await admin.supabase
    .from("events")
    .update({
      status: "active",
      approved_by: admin.profile.id,
      approved_at: new Date().toISOString(),
    })
    .eq("id", eventId)
    .eq("status", "pending_approval")
    .select("id")
    .maybeSingle();

  if (error) {
    throw new AppError("Failed to approve event", { code: "DATABASE", cause: error });
  }
  if (!data) {
    throw new AppError("Event is not pending approval", {
      code: "CONFLICT",
      status: 409,
      expose: true,
    });
  }

  await logAdminAction(admin, {
    action: "event.approve",
    entityType: "event",
    entityId: eventId,
  });

  return getAdminEventDetail(admin, eventId);
}

export async function rejectEvent(
  admin: AdminContext,
  eventId: string,
  reason?: string,
): Promise<AdminEventDetail> {
  const { data, error } = await admin.supabase
    .from("events")
    .update({ status: "cancelled" })
    .eq("id", eventId)
    .eq("status", "pending_approval")
    .select("id")
    .maybeSingle();

  if (error) {
    throw new AppError("Failed to reject event", { code: "DATABASE", cause: error });
  }
  if (!data) {
    throw new AppError("Event is not pending approval", {
      code: "CONFLICT",
      status: 409,
      expose: true,
    });
  }

  await logAdminAction(admin, {
    action: "event.reject",
    entityType: "event",
    entityId: eventId,
    metadata: reason ? { reason } : undefined,
  });

  return getAdminEventDetail(admin, eventId);
}

async function countStuckPayments(admin: AdminContext): Promise<number> {
  const stuck = await listStuckPaymentsForDashboard(admin);
  return stuck.length;
}

async function listStuckPaymentsForDashboard(admin: AdminContext): Promise<unknown[]> {
  const { data: payments } = await admin.supabase
    .from("payments")
    .select("id, status, webhook_verified, created_at, order_id")
    .in("status", ["pending", "completed"])
    .order("created_at", { ascending: false })
    .limit(100);

  const cutoff = Date.now() - 15 * 60 * 1000;
  const stuck: unknown[] = [];

  for (const p of payments ?? []) {
    const { data: order } = await admin.supabase
      .from("orders")
      .select("status")
      .eq("id", p.order_id)
      .maybeSingle();
    if (!order) continue;
    if (p.status === "completed" && !p.webhook_verified && order.status !== "confirmed") {
      stuck.push(p);
      continue;
    }
    if (
      p.status === "pending" &&
      order.status === "pending" &&
      new Date(p.created_at).getTime() < cutoff
    ) {
      stuck.push(p);
    }
  }
  return stuck;
}

async function loadOrganizerSummary(
  admin: AdminContext,
  organizerId: string,
): Promise<{ name: string; email: string }> {
  const { data } = await admin.supabase
    .from("users")
    .select("full_name, email")
    .eq("id", organizerId)
    .maybeSingle();
  return { name: data?.full_name ?? "Unknown", email: data?.email ?? "" };
}
