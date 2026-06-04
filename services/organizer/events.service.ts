import { AppError } from "@/lib/errors";
import type { OrganizerContext } from "@/lib/organizer-auth";
import type { EventStatus } from "@/types/database";
import type {
  OrganizerDashboardStats,
  OrganizerEventDetail,
  OrganizerEventSummary,
} from "@/types/organizer";

const EDITABLE: EventStatus[] = ["draft", "pending_approval"];

export async function listOrganizerEvents(
  ctx: OrganizerContext,
): Promise<OrganizerEventSummary[]> {
  const { data, error } = await ctx.supabase
    .from("events")
    .select("id, title, venue, event_date, sale_ends_at, status, created_at, updated_at")
    .eq("organizer_id", ctx.profile.id)
    .order("created_at", { ascending: false });

  if (error) {
    throw new AppError("Failed to load events", { code: "DATABASE", cause: error });
  }

  return (data ?? []).map(mapEventSummary);
}

export async function getOrganizerDashboard(
  ctx: OrganizerContext,
): Promise<OrganizerDashboardStats> {
  const events = await listOrganizerEvents(ctx);
  return {
    eventsTotal: events.length,
    eventsDraft: events.filter((e) => e.status === "draft").length,
    eventsPendingApproval: events.filter((e) => e.status === "pending_approval").length,
    eventsActive: events.filter((e) => e.status === "active").length,
    eventsCompleted: events.filter((e) => e.status === "completed").length,
  };
}

export async function getOrganizerEvent(
  ctx: OrganizerContext,
  eventId: string,
): Promise<OrganizerEventDetail> {
  const { data, error } = await ctx.supabase
    .from("events")
    .select(
      "id, title, description, venue, event_date, sale_ends_at, status, max_tickets_per_order, refund_policy_note, approved_at, created_at, updated_at",
    )
    .eq("id", eventId)
    .eq("organizer_id", ctx.profile.id)
    .maybeSingle();

  if (error) {
    throw new AppError("Failed to load event", { code: "DATABASE", cause: error });
  }
  if (!data) {
    throw new AppError("Event not found", { code: "NOT_FOUND", status: 404, expose: true });
  }

  return {
    ...mapEventSummary(data),
    description: data.description,
    maxTicketsPerOrder: data.max_tickets_per_order,
    refundPolicyNote: data.refund_policy_note,
    approvedAt: data.approved_at,
  };
}

export async function createOrganizerEvent(
  ctx: OrganizerContext,
  input: {
    title: string;
    description?: string | null;
    venue: string;
    eventDate: string;
    saleEndsAt: string;
    maxTicketsPerOrder?: number;
    refundPolicyNote?: string | null;
  },
): Promise<OrganizerEventDetail> {
  validateSchedule(input.eventDate, input.saleEndsAt);

  const { data, error } = await ctx.supabase
    .from("events")
    .insert({
      organizer_id: ctx.profile.id,
      title: input.title,
      description: input.description ?? null,
      venue: input.venue,
      event_date: input.eventDate,
      sale_ends_at: input.saleEndsAt,
      status: "draft",
      max_tickets_per_order: input.maxTicketsPerOrder ?? 10,
      refund_policy_note: input.refundPolicyNote ?? null,
    })
    .select(
      "id, title, description, venue, event_date, sale_ends_at, status, max_tickets_per_order, refund_policy_note, approved_at, created_at, updated_at",
    )
    .single();

  if (error || !data) {
    throw new AppError("Failed to create event", { code: "DATABASE", cause: error });
  }

  return {
    ...mapEventSummary(data),
    description: data.description,
    maxTicketsPerOrder: data.max_tickets_per_order,
    refundPolicyNote: data.refund_policy_note,
    approvedAt: data.approved_at,
  };
}

export async function updateOrganizerEvent(
  ctx: OrganizerContext,
  eventId: string,
  input: Partial<{
    title: string;
    description: string | null;
    venue: string;
    eventDate: string;
    saleEndsAt: string;
    maxTicketsPerOrder: number;
    refundPolicyNote: string | null;
  }>,
): Promise<OrganizerEventDetail> {
  const existing = await getOrganizerEvent(ctx, eventId);
  assertEditable(existing.status);

  const eventDate = input.eventDate ?? existing.eventDate;
  const saleEndsAt = input.saleEndsAt ?? existing.saleEndsAt;
  validateSchedule(eventDate, saleEndsAt);

  const { data, error } = await ctx.supabase
    .from("events")
    .update({
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.venue !== undefined ? { venue: input.venue } : {}),
      ...(input.eventDate !== undefined ? { event_date: input.eventDate } : {}),
      ...(input.saleEndsAt !== undefined ? { sale_ends_at: input.saleEndsAt } : {}),
      ...(input.maxTicketsPerOrder !== undefined
        ? { max_tickets_per_order: input.maxTicketsPerOrder }
        : {}),
      ...(input.refundPolicyNote !== undefined
        ? { refund_policy_note: input.refundPolicyNote }
        : {}),
    })
    .eq("id", eventId)
    .select(
      "id, title, description, venue, event_date, sale_ends_at, status, max_tickets_per_order, refund_policy_note, approved_at, created_at, updated_at",
    )
    .single();

  if (error || !data) {
    throw new AppError("Failed to update event", { code: "DATABASE", cause: error });
  }

  return {
    ...mapEventSummary(data),
    description: data.description,
    maxTicketsPerOrder: data.max_tickets_per_order,
    refundPolicyNote: data.refund_policy_note,
    approvedAt: data.approved_at,
  };
}

export async function submitOrganizerEventForApproval(
  ctx: OrganizerContext,
  eventId: string,
): Promise<OrganizerEventDetail> {
  const existing = await getOrganizerEvent(ctx, eventId);
  if (existing.status !== "draft") {
    throw new AppError("Only draft events can be submitted for approval", {
      code: "CONFLICT",
      status: 409,
      expose: true,
    });
  }

  const { count: typeCount } = await ctx.supabase
    .from("ticket_types")
    .select("id", { count: "exact", head: true })
    .eq("event_id", eventId);

  if (!typeCount) {
    throw new AppError("Add at least one ticket type before submitting", {
      code: "VALIDATION_ERROR",
      status: 400,
      expose: true,
    });
  }

  const { data, error } = await ctx.supabase
    .from("events")
    .update({ status: "pending_approval" })
    .eq("id", eventId)
    .eq("status", "draft")
    .select(
      "id, title, description, venue, event_date, sale_ends_at, status, max_tickets_per_order, refund_policy_note, approved_at, created_at, updated_at",
    )
    .single();

  if (error || !data) {
    throw new AppError("Failed to submit event for approval", {
      code: "DATABASE",
      cause: error,
    });
  }

  return {
    ...mapEventSummary(data),
    description: data.description,
    maxTicketsPerOrder: data.max_tickets_per_order,
    refundPolicyNote: data.refund_policy_note,
    approvedAt: data.approved_at,
  };
}

function mapEventSummary(row: {
  id: string;
  title: string;
  venue: string;
  event_date: string;
  sale_ends_at: string;
  status: EventStatus;
  created_at: string;
  updated_at: string;
}): OrganizerEventSummary {
  return {
    id: row.id,
    title: row.title,
    venue: row.venue,
    eventDate: row.event_date,
    saleEndsAt: row.sale_ends_at,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function assertEditable(status: EventStatus): void {
  if (!EDITABLE.includes(status)) {
    throw new AppError("Event cannot be edited in its current status", {
      code: "CONFLICT",
      status: 409,
      expose: true,
    });
  }
}

function validateSchedule(eventDate: string, saleEndsAt: string): void {
  if (new Date(saleEndsAt) > new Date(eventDate)) {
    throw new AppError("Sale end must be on or before the event date", {
      code: "VALIDATION_ERROR",
      status: 400,
      expose: true,
    });
  }
}

export function isEventEditable(status: EventStatus): boolean {
  return EDITABLE.includes(status);
}
