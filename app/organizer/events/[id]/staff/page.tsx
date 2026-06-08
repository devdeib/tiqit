import Link from "next/link";
import { StaffManager } from "@/components/organizer/staff-manager";
import { getOrganizerContext } from "@/lib/organizer-auth";
import { getOrganizerEvent } from "@/services/organizer/events.service";
import { listEventStaffAssignments, listStaffOptions } from "@/services/organizer/staff.service";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ id: string }> };

export default async function OrganizerStaffPage({ params }: Props) {
  const { id } = await params;
  const ctx = await getOrganizerContext();
  if (!ctx) return null;
  const [event, assignments, staffOptions] = await Promise.all([getOrganizerEvent(ctx, id), listEventStaffAssignments(ctx, id), listStaffOptions(ctx)]);

  return (
    <main style={{ paddingTop:"40px" }}>
      <Link href={`/organizer/events/${id}`} style={{ fontSize:"10px", letterSpacing:".1em", textTransform:"uppercase", color:"var(--tq-muted)", textDecoration:"none", display:"inline-block", marginBottom:"20px" }}>← {event.title}</Link>
      <h1 style={{ fontSize:"28px", fontWeight:900, letterSpacing:"-0.04em", marginBottom:"6px" }}>Staff assignment</h1>
      <p style={{ fontSize:"13px", color:"var(--tq-muted)", marginBottom:"28px" }}>Assign staff members who can scan tickets at the door.</p>
      <StaffManager eventId={id} initialAssignments={assignments} staffOptions={staffOptions} />
    </main>
  );
}
