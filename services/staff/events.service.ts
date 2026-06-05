import { AppError } from "@/lib/errors";
import type { StaffContext } from "@/lib/staff-auth";
import type { StaffAssignedEvent } from "@/types/staff";

export async function listStaffAssignedEvents(
  staff: StaffContext,
): Promise<StaffAssignedEvent[]> {
  const { data: assignments, error } = await staff.supabase
    .from("staff_event_assignments")
    .select("event_id, assigned_at")
    .eq("staff_id", staff.profile.id)
    .order("assigned_at", { ascending: false });

  if (error) {
    throw new AppError("Failed to load assignments", { code: "DATABASE", cause: error });
  }

  const rows: StaffAssignedEvent[] = [];
  for (const a of assignments ?? []) {
    const { data: event } = await staff.supabase
      .from("events")
      .select("id, title, venue, event_date, status")
      .eq("id", a.event_id)
      .maybeSingle();

    if (!event) continue;

    rows.push({
      id: event.id,
      title: event.title,
      venue: event.venue,
      eventDate: event.event_date,
      status: event.status,
      assignedAt: a.assigned_at,
    });
  }

  return rows;
}
