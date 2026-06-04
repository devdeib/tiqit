import { AppError } from "@/lib/errors";
import type { OrganizerContext } from "@/lib/organizer-auth";
import { getOrganizerEvent } from "@/services/organizer/events.service";
import type { OrganizerStaffAssignment, OrganizerStaffOption } from "@/types/organizer";

export async function listStaffOptions(ctx: OrganizerContext): Promise<OrganizerStaffOption[]> {
  const { data, error } = await ctx.supabase
    .from("users")
    .select("id, full_name, email")
    .eq("role", "staff")
    .eq("is_active", true)
    .order("full_name", { ascending: true });

  if (error) {
    throw new AppError("Failed to load staff directory", { code: "DATABASE", cause: error });
  }

  return (data ?? []).map((u) => ({
    id: u.id,
    fullName: u.full_name,
    email: u.email,
  }));
}

export async function listEventStaffAssignments(
  ctx: OrganizerContext,
  eventId: string,
): Promise<OrganizerStaffAssignment[]> {
  await getOrganizerEvent(ctx, eventId);

  const { data: assignments, error } = await ctx.supabase
    .from("staff_event_assignments")
    .select("id, staff_id, assigned_at")
    .eq("event_id", eventId)
    .order("assigned_at", { ascending: false });

  if (error) {
    throw new AppError("Failed to load staff assignments", { code: "DATABASE", cause: error });
  }

  const rows: OrganizerStaffAssignment[] = [];
  for (const row of assignments ?? []) {
    const { data: staff } = await ctx.supabase
      .from("users")
      .select("full_name, email")
      .eq("id", row.staff_id)
      .maybeSingle();

    rows.push({
      id: row.id,
      staffId: row.staff_id,
      staffName: staff?.full_name ?? "Unknown",
      staffEmail: staff?.email ?? "",
      assignedAt: row.assigned_at,
    });
  }

  return rows;
}

export async function assignStaffToEvent(
  ctx: OrganizerContext,
  eventId: string,
  staffId: string,
): Promise<OrganizerStaffAssignment> {
  await getOrganizerEvent(ctx, eventId);

  const { data, error } = await ctx.supabase
    .from("staff_event_assignments")
    .insert({
      staff_id: staffId,
      event_id: eventId,
      assigned_by: ctx.profile.id,
    })
    .select("id, staff_id, assigned_at")
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new AppError("Staff member is already assigned to this event", {
        code: "CONFLICT",
        status: 409,
        expose: true,
      });
    }
    throw new AppError("Failed to assign staff", { code: "DATABASE", cause: error });
  }

  if (!data) {
    throw new AppError("Failed to assign staff", { code: "DATABASE" });
  }

  const { data: staff } = await ctx.supabase
    .from("users")
    .select("full_name, email")
    .eq("id", staffId)
    .maybeSingle();

  return {
    id: data.id,
    staffId: data.staff_id,
    staffName: staff?.full_name ?? "Unknown",
    staffEmail: staff?.email ?? "",
    assignedAt: data.assigned_at,
  };
}

export async function removeStaffAssignment(
  ctx: OrganizerContext,
  eventId: string,
  assignmentId: string,
): Promise<void> {
  await getOrganizerEvent(ctx, eventId);

  const { error } = await ctx.supabase
    .from("staff_event_assignments")
    .delete()
    .eq("id", assignmentId)
    .eq("event_id", eventId);

  if (error) {
    throw new AppError("Failed to remove staff assignment", { code: "DATABASE", cause: error });
  }
}
